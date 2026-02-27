from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.dashboard_service import (
    get_monthly_summary,
    get_category_stats,
    get_daily_stats,
    get_recent_transactions,
)
from app.core.security import get_current_user


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def monthly_summary(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_monthly_summary(db, current_user)


@router.get("/category")
def category_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_category_stats(db, current_user)


@router.get("/daily")
def daily_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_daily_stats(db, current_user)


@router.get("/recent")
def recent_transactions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_recent_transactions(db, current_user)