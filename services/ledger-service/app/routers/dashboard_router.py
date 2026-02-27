from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.dashboard_service import (
    get_monthly_summary,
    get_category_stats,
    get_daily_stats,
    get_recent_transactions
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


from app.core.security import get_current_user_id


@router.get("/summary")
def monthly_summary(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return get_monthly_summary(db, user_id=user_id)


@router.get("/category")
def category_stats(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return get_category_stats(db, user_id)


@router.get("/daily")
def daily_stats(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return get_daily_stats(db, user_id)


@router.get("/recent")
def recent_transactions(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return get_recent_transactions(db, user_id)
