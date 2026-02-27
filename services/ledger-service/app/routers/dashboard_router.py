from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.session import get_db
from app.services.dashboard_service import (
    get_monthly_summary,
    get_category_stats,
    get_daily_stats,
    get_recent_transactions,
)
from app.core.security import get_current_user


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# 🔹 월 기본값 계산용 함수
def _resolve_year_month(year: int | None, month: int | None):
    now = datetime.now()
    return year or now.year, month or now.month


@router.get("/summary")
def monthly_summary(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    year, month = _resolve_year_month(year, month)
    return get_monthly_summary(db, current_user, year, month)


@router.get("/category")
def category_stats(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    year, month = _resolve_year_month(year, month)
    return get_category_stats(db, current_user, year, month)


@router.get("/daily")
def daily_stats(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    year, month = _resolve_year_month(year, month)
    return get_daily_stats(db, current_user, year, month)


@router.get("/recent")
def recent_transactions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_recent_transactions(db, current_user)