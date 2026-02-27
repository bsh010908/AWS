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
        success_url="http://localhost:5500/frontend/success.html",
        cancel_url="http://localhost:5500/frontend/cancel.html",
        customer_email=current_user.email,

        metadata={
            "user_id": str(current_user.user_id)
        }
    )

    return {"checkout_url": session.url}


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
            db.commit()

        db.close()

    return {"status": "success"}