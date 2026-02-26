from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db.database import get_db
from ..schemas import user_schemas as schemas
from ..services import user_service
from ..core.security import get_current_user
from ..db import models

router = APIRouter()


@router.post("/signup", response_model=schemas.UserResponse)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    return user_service.create_user(user, db)


@router.post("/login")
def login(user: schemas.UserCreate, db: Session = Depends(get_db)):
    return user_service.login_user(user, db)


@router.get("/me")
def read_me(current_user: models.User = Depends(get_current_user)):
    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role
    }