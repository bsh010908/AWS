from datetime import datetime, timezone
import os

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.security import get_current_user
from ..db.database import SessionLocal
from ..models.user import User

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/billing", tags=["Billing"])
endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")


# ===============================
# Utils
# ===============================
def _to_datetime_from_unix(ts: int | None):
    if not ts:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).replace(tzinfo=None)


def _find_user_by_subscription_or_customer(
    db: Session,
    subscription_id: str | None,
    customer_id: str | None,
):
    user = None
    if subscription_id:
        user = (
            db.query(User)
            .filter(User.stripe_subscription_id == subscription_id)
            .first()
        )
    if not user and customer_id:
        user = (
            db.query(User)
            .filter(User.stripe_customer_id == customer_id)
            .first()
        )
    return user


def _find_user_by_customer_email(db: Session, customer_id: str | None):
    if not customer_id:
        return None
    try:
        customer = stripe.Customer.retrieve(customer_id)
    except Exception:
        return None

    email = customer.get("email")
    if not email:
        return None

    return db.query(User).filter(User.email == email).first()


def _find_active_subscription_for_customer(customer_id: str):
    subs = stripe.Subscription.list(customer=customer_id, status="all", limit=20)
    return next(
        (
            s
            for s in subs.data
            if s.status in ("active", "trialing", "past_due", "unpaid")
        ),
        None,
    )


def _find_active_subscription_for_user(user: User):
    if user.stripe_subscription_id:
        try:
            sub = stripe.Subscription.retrieve(user.stripe_subscription_id)
            if sub and sub.status in ("active", "trialing", "past_due", "unpaid"):
                return sub
        except Exception:
            pass

    if user.stripe_customer_id:
        sub = _find_active_subscription_for_customer(user.stripe_customer_id)
        if sub:
            return sub

    if not user.email:
        return None

    customers = stripe.Customer.list(email=user.email, limit=20)
    for customer in customers.data:
        sub = _find_active_subscription_for_customer(customer.id)
        if sub:
            return sub

    return None


def _safe_retrieve_subscription(sub_id: str | None):
    """
    sub_id가 None/빈 값이면 Stripe 호출하지 않도록 방어.
    """
    if not sub_id or not isinstance(sub_id, str):
        return None
    try:
        return stripe.Subscription.retrieve(sub_id)
    except Exception:
        return None


def _safe_retrieve_invoice(invoice_id: str | None):
    if not invoice_id or not isinstance(invoice_id, str):
        return None
    try:
        return stripe.Invoice.retrieve(invoice_id)
    except Exception:
        return None


def _safe_retrieve_checkout_session(session_id: str | None):
    """
    checkout.session.completed에서 subscription이 None인 경우가 있어,
    세션을 다시 조회해 subscription/customer를 최대한 확보하기 위한 용도.
    """
    if not session_id or not isinstance(session_id, str):
        return None
    try:
        # expand로 subscription/customer를 더 잘 가져올 수 있음
        return stripe.checkout.Session.retrieve(
            session_id,
            expand=["subscription", "customer"],
        )
    except Exception:
        return None


# ===============================
# Billing APIs
# ===============================
@router.post("/create-checkout-session")
def create_checkout_session(current_user=Depends(get_current_user)):
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="subscription",
        line_items=[
            {
                "price_data": {
                    "currency": "krw",
                    "product_data": {"name": "PRO Plan"},
                    "unit_amount": 4900,
                    "recurring": {"interval": "month"},
                },
                "quantity": 1,
            }
        ],
        success_url="http://localhost:5500/frontend/app.html?billing=success#/subscription",
        cancel_url="http://localhost:5500/frontend/app.html?billing=cancel#/subscription",
        customer_email=current_user.email,
        metadata={"user_id": str(current_user.user_id)},
    )
    return {"checkout_url": session.url}


@router.post("/sync-subscription")
def sync_subscription(current_user=Depends(get_current_user)):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == current_user.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        active_sub = _find_active_subscription_for_user(user)

        if active_sub:
            user.plan = "PRO"
            user.subscription_status = "ACTIVE"
            user.stripe_customer_id = active_sub.get("customer")
            user.stripe_subscription_id = active_sub.id
            user.next_billing_at = _to_datetime_from_unix(
                active_sub.get("current_period_end")
            )
        else:
            user.plan = "FREE"
            user.subscription_status = "CANCELED"
            user.stripe_subscription_id = None
            user.next_billing_at = None

        db.commit()

        return {
            "plan": user.plan,
            "subscription_status": user.subscription_status,
            "next_billing_at": (
                user.next_billing_at.isoformat() if user.next_billing_at else None
            ),
        }
    finally:
        db.close()


@router.post("/cancel-subscription")
def cancel_subscription(current_user=Depends(get_current_user)):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == current_user.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        subscription = _find_active_subscription_for_user(user)
        if subscription and subscription.status not in ("canceled", "incomplete_expired"):
            try:
                stripe.Subscription.delete(subscription.id)
            except Exception:
                pass

        user.plan = "FREE"
        user.subscription_status = "CANCELED"
        user.stripe_subscription_id = None
        user.next_billing_at = None
        db.commit()

        return {"message": "구독 취소 처리 완료"}
    finally:
        db.close()


def _upsert_subscription_state(
    db: Session,
    *,
    user: User,
    customer_id: str | None,
    sub_id: str | None,
    fallback_period_end: int | None = None,
):
    """
    next_billing_at를 안정적으로 저장하기 위한 공통 로직.

    - sub_id가 있으면 Subscription 조회해서 current_period_end 저장 (가장 정확)
    - sub_id가 없거나 조회 실패면 fallback_period_end(이벤트에서 얻은 값)로 저장
    """
    user.plan = "PRO"
    user.subscription_status = "ACTIVE"

    if customer_id:
        user.stripe_customer_id = customer_id

    if sub_id:
        user.stripe_subscription_id = sub_id

    # 1) 이벤트에서 기간 종료(end)가 있으면 우선 반영(조회 실패 대비)
    if fallback_period_end:
        user.next_billing_at = _to_datetime_from_unix(fallback_period_end)

    # 2) 가능하면 Subscription 조회로 통일
    sub = _safe_retrieve_subscription(sub_id)
    if sub and sub.get("current_period_end"):
        user.next_billing_at = _to_datetime_from_unix(sub.get("current_period_end"))


# ===============================
# Webhook
# ===============================
@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    event_type = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}

    print("EVENT TYPE:", event_type)

    db: Session = SessionLocal()
    try:
        # ===============================
        # 1) 결제 완료 (Checkout)
        #   - 여기서는 subscription이 None일 수 있음 (레이스)
        #   - 그래서 세션을 다시 조회해서 sub/customer를 최대한 복구한다.
        # ===============================
        if event_type == "checkout.session.completed":
            user_id = (obj.get("metadata") or {}).get("user_id")
            if not user_id:
                return {"status": "ignored_no_user_id"}

            user = db.query(User).filter(User.user_id == int(user_id)).first()
            if not user:
                return {"status": "ignored_user_not_found"}

            # 1) 이벤트에서 우선 추출
            customer_id = obj.get("customer")
            sub_id = obj.get("subscription")  # None 가능
            session_id = obj.get("id")

            # 2) subscription이 None이면 세션을 재조회해서 복구
            if not sub_id and session_id:
                sess = _safe_retrieve_checkout_session(session_id)
                if sess:
                    # expand된 subscription이 객체로 올 수 있음
                    sub_val = sess.get("subscription")
                    if isinstance(sub_val, dict):
                        sub_id = sub_val.get("id")
                    elif isinstance(sub_val, str):
                        sub_id = sub_val

                    cust_val = sess.get("customer")
                    if isinstance(cust_val, dict):
                        customer_id = customer_id or cust_val.get("id")
                    elif isinstance(cust_val, str):
                        customer_id = customer_id or cust_val

            # checkout은 next_billing 확정 지점이 아니지만,
            # sub_id를 확보했으면 Subscription 조회로 next_billing도 채워둘 수 있다.
            _upsert_subscription_state(
                db,
                user=user,
                customer_id=customer_id,
                sub_id=sub_id,
                fallback_period_end=None,
            )
            db.commit()

        # ===============================
        # 2) 결제 성공 (가장 확실한 지점)
        #   - Stripe 표준 이벤트명: invoice.payment_succeeded
        # ===============================
        elif event_type == "invoice.payment_succeeded":
            sub_id = obj.get("subscription")
            customer_id = obj.get("customer")

            if not sub_id and not customer_id:
                return {"status": "ignored_no_ids"}

            user = _find_user_by_subscription_or_customer(db, sub_id, customer_id)
            if not user:
                user = _find_user_by_customer_email(db, customer_id)

            if not user:
                return {"status": "ignored_user_not_found"}

            fallback_end = None
            try:
                lines = (obj.get("lines") or {}).get("data") or []
                if lines:
                    fallback_end = (lines[0].get("period") or {}).get("end")
            except Exception:
                fallback_end = None

            _upsert_subscription_state(
                db,
                user=user,
                customer_id=customer_id,
                sub_id=sub_id,
                fallback_period_end=fallback_end,
            )
            db.commit()

        # ===============================
        # 3) 구독 생성/변경
        # ===============================
        elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
            sub_id = obj.get("id")
            customer_id = obj.get("customer")
            fallback_end = obj.get("current_period_end")

            if not sub_id and not customer_id:
                return {"status": "ignored_no_ids"}

            user = _find_user_by_subscription_or_customer(db, sub_id, customer_id)
            if not user:
                user = _find_user_by_customer_email(db, customer_id)

            if user:
                _upsert_subscription_state(
                    db,
                    user=user,
                    customer_id=customer_id,
                    sub_id=sub_id,
                    fallback_period_end=fallback_end,
                )
                db.commit()

        # ===============================
        # 4) 구독 취소
        # ===============================
        elif event_type == "customer.subscription.deleted":
            sub_id = obj.get("id")
            customer_id = obj.get("customer")

            user = _find_user_by_subscription_or_customer(db, sub_id, customer_id)
            if not user:
                user = _find_user_by_customer_email(db, customer_id)

            if user:
                user.plan = "FREE"
                user.subscription_status = "CANCELED"
                user.stripe_subscription_id = None
                user.next_billing_at = None
                db.commit()

        else:
            return {"status": "ignored_event", "event_type": event_type}

    finally:
        db.close()

    return {"status": "success"}