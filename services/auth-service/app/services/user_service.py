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


def _verify_password(raw_password: str, hashed_password: str):
    return bcrypt.checkpw(
        raw_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def change_email(
    current_user: User,
    payload: schemas.ChangeEmailRequest,
    db: Session,
):
    if current_user.email == payload.new_email:
        raise HTTPException(status_code=400, detail="현재 이메일과 동일합니다.")

    exists_email = (
        db.query(User)
        .filter(User.email == payload.new_email, User.user_id != current_user.user_id)
        .first()
    )
    if exists_email:
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")

    current_user.email = payload.new_email
    db.commit()
    db.refresh(current_user)

    return {"message": "이메일이 변경되었습니다.", "email": current_user.email}


def change_password(
    current_user: User,
    payload: schemas.ChangePasswordRequest,
    db: Session,
):
    if not _verify_password(payload.current_password, current_user.password):
        raise HTTPException(status_code=400, detail="현재 비밀번호가 일치하지 않습니다.")

    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="새 비밀번호가 현재 비밀번호와 동일합니다.")

    hashed_pw = bcrypt.hashpw(payload.new_password.encode("utf-8"), bcrypt.gensalt())
    current_user.password = hashed_pw.decode("utf-8")
    db.commit()

    return {"message": "비밀번호가 변경되었습니다. 다시 로그인해 주세요."}


def delete_account(
    current_user: User,
    payload: schemas.DeleteAccountRequest,
    db: Session,
):
    if not _verify_password(payload.current_password, current_user.password):
        raise HTTPException(status_code=400, detail="현재 비밀번호가 일치하지 않습니다.")

    db.delete(current_user)
    db.commit()

    return {"message": "회원 탈퇴가 완료되었습니다."}
