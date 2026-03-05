from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db.database import get_db
from ..schemas import user_schemas as schemas
from ..services import user_service
from ..core.security import get_current_user
from ..models.user import User

router = APIRouter()


@router.post("/signup", response_model=schemas.UserResponse)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    return user_service.create_user(user, db)


@router.post("/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    return user_service.login_user(user, db)


@router.get("/me")
def read_me(current_user: User = Depends(get_current_user)):
    return {
        "user_id": current_user.user_id,
        "username": current_user.username,
        "email": current_user.email,
        "name": current_user.name,
        "created_at": (
            current_user.created_at.isoformat()
            if getattr(current_user, "created_at", None)
            else None
        ),
        "plan": current_user.plan,
        "subscription_status": current_user.subscription_status,
        "next_billing_at": (
            current_user.next_billing_at.isoformat()
            if current_user.next_billing_at
            else None
        ),
    }


@router.put("/me/email")
def update_email(
    payload: schemas.ChangeEmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user_service.change_email(current_user, payload, db)


@router.put("/me/password")
def update_password(
    payload: schemas.ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user_service.change_password(current_user, payload, db)


@router.delete("/me")
def delete_me(
    payload: schemas.DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user_service.delete_account(current_user, payload, db)
