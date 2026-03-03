from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from fastapi import Body, HTTPException
from sqlalchemy import or_

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.category import Category

router = APIRouter(prefix="/categories", tags=["categories"])


from sqlalchemy import or_

@router.get("")
def get_categories(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    categories = (
        db.query(Category)
        .filter(
            or_(
                Category.user_id == None,
                Category.user_id == current_user["user_id"]
            )
        )
        .filter(Category.is_active == True)
        .all()
    )

    return [
        {
            "category_id": c.category_id,
            "name": c.name,
            "type": c.type
        }
        for c in categories
    ]


@router.post("")
def create_category(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    name = payload.get("name")

    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="카테고리 이름은 필수입니다")

    name = name.strip()

    # 🔥 중복 체크 (기본 + 본인 카테고리 포함)
    exists = (
        db.query(Category)
        .filter(
            or_(
                Category.user_id == None,
                Category.user_id == current_user["user_id"]
            )
        )
        .filter(Category.name == name)
        .first()
    )

    if exists:
        raise HTTPException(status_code=400, detail="이미 존재하는 카테고리입니다")

    new_category = Category(
        user_id=current_user["user_id"],
        name=name,
        type="EXPENSE",
        is_active=True
    )

    db.add(new_category)
    db.commit()
    db.refresh(new_category)

    return {
        "category_id": new_category.category_id,
        "name": new_category.name,
        "type": new_category.type
    }