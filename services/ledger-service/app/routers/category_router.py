from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from fastapi import Body, HTTPException
from sqlalchemy import or_

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.category import Category

router = APIRouter(prefix="/ledger/categories", tags=["categories"])

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
            "type": c.type,
            "user_id": c.user_id,
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
        "type": new_category.type,
        "user_id": new_category.user_id,
    }


@router.put("/{category_id}")
def update_category(
    category_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="카테고리 이름은 필수입니다")

    category = (
        db.query(Category)
        .filter(Category.category_id == category_id, Category.is_active == True)
        .first()
    )
    if not category:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다")

    # 기본 카테고리는 수정 불가
    if category.user_id is None:
        raise HTTPException(status_code=403, detail="기본 카테고리는 수정할 수 없습니다")

    # 본인 카테고리만 수정 가능
    if category.user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="본인 카테고리만 수정할 수 있습니다")

    exists = (
        db.query(Category)
        .filter(
            or_(
                Category.user_id == None,
                Category.user_id == current_user["user_id"],
            )
        )
        .filter(Category.name == name, Category.category_id != category_id, Category.is_active == True)
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="이미 존재하는 카테고리입니다")

    category.name = name
    db.commit()
    db.refresh(category)

    return {
        "category_id": category.category_id,
        "name": category.name,
        "type": category.type,
        "user_id": category.user_id,
    }


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    category = (
        db.query(Category)
        .filter(Category.category_id == category_id, Category.is_active == True)
        .first()
    )
    if not category:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다")

    # 기본 카테고리는 삭제 불가
    if category.user_id is None:
        raise HTTPException(status_code=403, detail="기본 카테고리는 삭제할 수 없습니다")

    # 본인 카테고리만 삭제 가능
    if category.user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="본인 카테고리만 삭제할 수 있습니다")

    # 삭제 대신 비활성화(기존 거래 이력 안전)
    category.is_active = False
    db.commit()

    return {"message": "카테고리가 삭제되었습니다"}
