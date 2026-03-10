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
    if not sub_id or not isinstance(sub_id, str):
        return None
    try:
        return stripe.Subscription.retrieve(sub_id)
    except Exception:
        return None


def _safe_retrieve_checkout_session(session_id: str | None):
    if not session_id or not isinstance(session_id, str):
        return None
    try:
        return stripe.checkout.Session.retrieve(
            session_id,
            expand=["subscription", "customer"],
        )
    except Exception:
        return None


def _extract_id(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get("id")
    return None


def _find_user_by_object_metadata(db: Session, obj: dict):
    metadata = obj.get("metadata") or {}
    user_id = metadata.get("user_id") or obj.get("client_reference_id")
    if not user_id:
        return None

    try:
        return db.query(User).filter(User.user_id == int(user_id)).first()
    except Exception:
        return None


def _extract_period_end_from_invoice(invoice_obj: dict) -> int | None:
    """
    invoice object에서 다음 결제 기간 end를 최대한 안전하게 뽑는다.
    """
    try:
        lines = (invoice_obj.get("lines") or {}).get("data") or []
        if not lines:
            return None
        period = (lines[0].get("period") or {})
        return period.get("end")
    except Exception:
        return None


def _find_user_with_fallbacks(
    db: Session,
    *,
    sub_id: str | None,
    customer_id: str | None,
    event_obj: dict,
):
    user = _find_user_by_subscription_or_customer(db, sub_id, customer_id)
    if not user:
        user = _find_user_by_customer_email(db, customer_id)
    if not user:
        user = _find_user_by_object_metadata(db, event_obj)

    if not user and sub_id:
        try:
            sub = stripe.Subscription.retrieve(sub_id)
            metadata = sub.get("metadata") or {}
            metadata_user_id = metadata.get("user_id")
            if metadata_user_id:
                user = db.query(User).filter(User.user_id == int(metadata_user_id)).first()
        except Exception:
            pass

    return user


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

    if fallback_period_end:
        user.next_billing_at = _to_datetime_from_unix(fallback_period_end)

    sub = _safe_retrieve_subscription(sub_id)
    if sub and sub.get("current_period_end"):
        user.next_billing_at = _to_datetime_from_unix(sub.get("current_period_end"))


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
        success_url="http://43.201.103.180/app.html?billing=success&session_id={CHECKOUT_SESSION_ID}#/settings",
        cancel_url="http://43.201.103.180/app.html?billing=cancel#/settings",        customer_email=current_user.email,
        client_reference_id=str(current_user.user_id),
        subscription_data={"metadata": {"user_id": str(current_user.user_id)}},
        metadata={"user_id": str(current_user.user_id)},
    )
    return {"checkout_url": session.url}


@router.post("/sync-subscription")
def sync_subscription(request: Request, current_user=Depends(get_current_user)):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == current_user.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        session_id = request.query_params.get("session_id")
        if session_id:
            sess = _safe_retrieve_checkout_session(session_id)
            if sess:
                customer_id = _extract_id(sess.get("customer"))
                sub_id = _extract_id(sess.get("subscription"))
                fallback_end = None

                if not sub_id and customer_id:
                    active_sub = _find_active_subscription_for_customer(customer_id)
                    if active_sub:
                        sub_id = active_sub.get("id")
                        fallback_end = active_sub.get("current_period_end")

                if sub_id or customer_id:
                    _upsert_subscription_state(
                        db,
                        user=user,
                        customer_id=customer_id,
                        sub_id=sub_id,
                        fallback_period_end=fallback_end,
                    )
                    db.commit()
                    return {
                        "plan": user.plan,
                        "subscription_status": user.subscription_status,
                        "next_billing_at": (
                            user.next_billing_at.isoformat() if user.next_billing_at else None
                        ),
                    }

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
        # ===============================
        if event_type == "checkout.session.completed":
            user_id = (obj.get("metadata") or {}).get("user_id") or obj.get("client_reference_id")
            customer_id = obj.get("customer")
            sub_id = obj.get("subscription")  # None 가능
            session_id = obj.get("id")
            fallback_end = None

            user = None
            if user_id:
                try:
                    user = db.query(User).filter(User.user_id == int(user_id)).first()
                except Exception:
                    user = None

            if not sub_id and session_id:
                sess = _safe_retrieve_checkout_session(session_id)
                if sess:
                    sub_val = sess.get("subscription")
                    sub_id = _extract_id(sub_val) or sub_id

                    cust_val = sess.get("customer")
                    customer_id = customer_id or _extract_id(cust_val)

            if not sub_id and customer_id:
                active_sub = _find_active_subscription_for_customer(customer_id)
                if active_sub:
                    sub_id = active_sub.get("id")
                    fallback_end = active_sub.get("current_period_end")

            if not user:
                user = _find_user_with_fallbacks(
                    db,
                    sub_id=sub_id,
                    customer_id=customer_id,
                    event_obj=obj,
                )
            if not user:
                return {"status": "ignored_user_not_found"}

            _upsert_subscription_state(
                db,
                user=user,
                customer_id=customer_id,
                sub_id=sub_id,
                fallback_period_end=fallback_end,
            )
            db.commit()
            return {"status": "ok_checkout_completed"}

        # ===============================
        # 2) 결제 성공 (Stripe 표준)
        # ===============================
        if event_type == "invoice.payment_succeeded":
            sub_id = _extract_id(obj.get("subscription"))
            customer_id = _extract_id(obj.get("customer"))

            if not sub_id and not customer_id:
                return {"status": "ignored_no_ids"}

            user = _find_user_with_fallbacks(
                db,
                sub_id=sub_id,
                customer_id=customer_id,
                event_obj=obj,
            )
            if not user:
                return {"status": "ignored_user_not_found"}

            fallback_end = _extract_period_end_from_invoice(obj)

            _upsert_subscription_state(
                db,
                user=user,
                customer_id=customer_id,
                sub_id=sub_id,
                fallback_period_end=fallback_end,
            )
            db.commit()
            return {"status": "ok_invoice_payment_succeeded"}

        # ===============================
        # 2-호환: Stripe CLI가 보내는 invoice_payment.paid
        #   - 이 이벤트는 data.object 자체가 invoice 이므로 "invoice id로 retrieve" 하면 안 됨
        # ===============================
        elif event_type == "invoice_payment.paid":

            sub_id = _extract_id(obj.get("subscription"))
            customer_id = _extract_id(obj.get("customer"))

            user = _find_user_with_fallbacks(
                db,
                sub_id=sub_id,
                customer_id=customer_id,
                event_obj=obj,
            )

            if not user:
                print("USER NOT FOUND")
                return {"status": "ignored_user_not_found"}

            fallback_end = _extract_period_end_from_invoice(obj)

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
        if event_type in ("customer.subscription.created", "customer.subscription.updated"):
            sub_id = obj.get("id")
            customer_id = _extract_id(obj.get("customer"))
            fallback_end = obj.get("current_period_end")

            if not sub_id and not customer_id:
                return {"status": "ignored_no_ids"}

            user = _find_user_with_fallbacks(
                db,
                sub_id=sub_id,
                customer_id=customer_id,
                event_obj=obj,
            )

            if user:
                _upsert_subscription_state(
                    db,
                    user=user,
                    customer_id=customer_id,
                    sub_id=sub_id,
                    fallback_period_end=fallback_end,
                )
                db.commit()
                return {"status": "ok_subscription_upsert"}

            return {"status": "ignored_user_not_found"}

        # ===============================
        # 4) 구독 취소
        # ===============================
        if event_type == "customer.subscription.deleted":
            sub_id = obj.get("id")
            customer_id = _extract_id(obj.get("customer"))

            user = _find_user_by_subscription_or_customer(db, sub_id, customer_id)
            if not user:
                user = _find_user_by_customer_email(db, customer_id)

            if user:
                user.plan = "FREE"
                user.subscription_status = "CANCELED"
                user.stripe_subscription_id = None
                user.next_billing_at = None
                db.commit()
                return {"status": "ok_subscription_deleted"}

            return {"status": "ignored_user_not_found"}

        return {"status": "ignored_event", "event_type": event_type}

    finally:
        db.close()
