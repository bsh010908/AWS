from fastapi import APIRouter, Depends
import stripe

from ..core.config import settings
from ..core.security import get_current_user

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.post("/create-checkout-session")
def create_checkout_session(current_user=Depends(get_current_user)):

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="subscription",
        line_items=[{
            "price_data": {
                "currency": "krw",
                "product_data": {
                    "name": "PRO Plan"
                },
                "unit_amount": 4900,
                "recurring": {
                    "interval": "month"
                }
            },
            "quantity": 1,
        }],
        success_url="http://localhost:3000/success",
        cancel_url="http://localhost:3000/cancel",
        customer_email=current_user.email,
    )

    return {"checkout_url": session.url}