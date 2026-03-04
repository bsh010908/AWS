from fastapi import APIRouter, Depends, Request, HTTPException
import stripe
import os
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.security import get_current_user
from ..db.database import SessionLocal
from ..models.user import User

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/billing", tags=["Billing"])

endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")


@router.post("/create-checkout-session")
def create_checkout_session(current_user=Depends(get_current_user)):

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="subscription",
        line_items=[{
            "price_data": {
                "currency": "krw",
                "product_data": {"name": "PRO Plan"},
                "unit_amount": 4900,
                "recurring": {"interval": "month"}
            },
            "quantity": 1,
        }],
        success_url="http://localhost:5500/frontend/app.html?billing=success#/subscription",
        cancel_url="http://localhost:5500/frontend/app.html?billing=cancel#/subscription",
        customer_email=current_user.email,

        metadata={
            "user_id": str(current_user.user_id)
        }
    )

    return {"checkout_url": session.url}


@router.post("/cancel-subscription")
def cancel_subscription(current_user=Depends(get_current_user)):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == current_user.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        subscription_id = user.stripe_subscription_id
        customer_id = user.stripe_customer_id

        if not customer_id and user.email:
            customers = stripe.Customer.list(email=user.email, limit=1)
            if customers.data:
                customer_id = customers.data[0].id
                user.stripe_customer_id = customer_id

        subscription = None

        if subscription_id:
            try:
                subscription = stripe.Subscription.retrieve(subscription_id)
            except Exception:
                subscription = None

        if not subscription and customer_id:
            subs = stripe.Subscription.list(
                customer=customer_id,
                status="all",
                limit=10,
            )
            subscription = next(
                (
                    s for s in subs.data
                    if s.status not in ("canceled", "incomplete_expired")
                ),
                None,
            )
            if subscription:
                subscription_id = subscription.id

        if subscription and subscription.status not in ("canceled", "incomplete_expired"):
            stripe.Subscription.delete(subscription_id)

        # 취소 API는 멱등하게 처리: Stripe 상 구독이 없더라도 로컬 상태는 FREE로 동기화
        user.plan = "FREE"
        user.subscription_status = "CANCELED"
        user.stripe_subscription_id = None
        db.commit()

        return {"message": "구독 취소 처리 완료"}
    finally:
        db.close()


@router.post("/webhook")
async def stripe_webhook(request: Request):

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"].get("user_id")

        db: Session = SessionLocal()
        user = db.query(User).filter(User.user_id == int(user_id)).first()

        if user:
            user.plan = "PRO"
            user.subscription_status = "ACTIVE"
            user.stripe_customer_id = session.get("customer")
            user.stripe_subscription_id = session.get("subscription")
            db.commit()

        db.close()

    return {"status": "success"}
