from sqlalchemy.orm import Session
import bcrypt
from fastapi import HTTPException

from ..models.user import User
from ..schemas import user_schemas as schemas
from ..core.security import create_access_token


def create_user(user: schemas.UserCreate, db: Session):

    # username 중복 체크
    exists_username = (
        db.query(User)
        .filter(User.username == user.username)
        .first()
    )
    if exists_username:
        raise HTTPException(status_code=400, detail="이미 사용 중인 아이디입니다.")

    # email 중복 체크
    exists_email = (
        db.query(User)
        .filter(User.email == user.email)
        .first()
    )
    if exists_email:
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")

    hashed_pw = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt())

    new_user = User(
        username=user.username,
        email=user.email,
        password=hashed_pw.decode("utf-8"),
        name=user.name,
        plan="FREE",
        subscription_status="NONE",
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


def login_user(user: schemas.UserLogin, db: Session):

    db_user = (
        db.query(User)
        .filter(User.username == user.username)
        .first()
    )

    if not db_user:
        raise HTTPException(status_code=400, detail="아이디 또는 비밀번호가 틀렸습니다.")

    if not bcrypt.checkpw(
        user.password.encode("utf-8"),
        db_user.password.encode("utf-8"),
    ):
        raise HTTPException(status_code=400, detail="아이디 또는 비밀번호가 틀렸습니다.")

    access_token = create_access_token(
        data={
            "sub": str(db_user.user_id),
            "plan": db_user.plan,
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }
