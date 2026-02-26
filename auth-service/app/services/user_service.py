from sqlalchemy.orm import Session
import bcrypt
from fastapi import HTTPException

from ..db import models
from ..schemas import user_schemas as schemas
from ..core.security import create_access_token


def create_user(user: schemas.UserCreate, db: Session):
    # username 중복 체크
    exists_username = db.query(models.User).filter(models.User.username == user.username).first()
    if exists_username:
        raise HTTPException(status_code=400, detail="이미 사용 중인 아이디입니다.")

    # email 중복 체크 (DB에서 unique면 안전빵)
    exists_email = db.query(models.User).filter(models.User.email == user.email).first()
    if exists_email:
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")

    hashed_pw = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt())

    new_user = models.User(
        username=user.username,
        email=user.email,
        password=hashed_pw.decode("utf-8"),
        name=user.name,
        role="USER",
        plan="FREE",
        subscription_status="NONE",
        monthly_ocr_used=0,
        status="ACTIVE",
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def login_user(user: schemas.UserLogin, db: Session):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()

    if not db_user:
        raise HTTPException(status_code=400, detail="아이디 또는 비밀번호가 틀렸습니다.")

    if not bcrypt.checkpw(user.password.encode("utf-8"), db_user.password.encode("utf-8")):
        raise HTTPException(status_code=400, detail="아이디 또는 비밀번호가 틀렸습니다.")

    access_token = create_access_token(data={"sub": str(db_user.user_id)})
    return {"access_token": access_token, "token_type": "bearer"}


import stripe
from fastapi import APIRouter, Depends
from ..core.config import settings
from ..core.security import get_current_user

stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/billing")

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