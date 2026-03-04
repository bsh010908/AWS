from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from sqlalchemy import desc, extract, func

from app.db.session import get_db
from app.models.transaction import Transaction
from app.services.dashboard_service import (
    get_monthly_summary,
    get_category_stats,
    get_daily_stats,
    get_dashboard_overview,
    generate_ai_insight,
)
from app.core.security import get_current_user


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ===============================
# 공통 월 기본값 처리
# ===============================
def _resolve_year_month(year: int | None, month: int | None):
    now = datetime.now()
    return year or now.year, month or now.month


# ===============================
# 통합 대시보드
# ===============================
@router.get("/overview")
def dashboard_overview(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    year, month = _resolve_year_month(year, month)
    return get_dashboard_overview(db, current_user, year, month)


# ===============================
# 월 요약
# ===============================
@router.get("/summary")
def monthly_summary(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    year, month = _resolve_year_month(year, month)
    return get_monthly_summary(db, current_user, year, month)


# ===============================
# 카테고리 통계
# ===============================
@router.get("/category")
def category_stats(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    year, month = _resolve_year_month(year, month)
    return get_category_stats(db, current_user, year, month)


# ===============================
# 일별 통계
# ===============================
@router.get("/daily")
def daily_stats(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    year, month = _resolve_year_month(year, month)
    return get_daily_stats(db, current_user, year, month)


# ===============================
# AI 인사이트
# ===============================
@router.get("/ai-insight")
def get_ai_insight(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("plan") != "PRO":
        raise HTTPException(status_code=403, detail="PRO 전용 기능입니다")

    year, month = _resolve_year_month(year, month)

    summary = get_monthly_summary(db, current_user, year, month)
    insight = generate_ai_insight(summary)

    return {"ai_insight": insight}


# ===============================
# 최근 거래
# ===============================
@router.get("/recent")
def get_recent_transactions(
    limit: int = Query(5),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user["user_id"])
        .order_by(desc(Transaction.occurred_at))
        .limit(limit)
        .all()
    )

    return [
        {
            "id": tx.tx_id,
            "amount": tx.amount,
            "merchant_name": tx.merchant_name,
            "occurred_at": tx.occurred_at.isoformat() if tx.occurred_at else None,
        }
        for tx in transactions
    ]
# ===============================
# 연도별 월 합계
# ===============================
@router.get("/yearly-summary")
def get_yearly_summary(
    year: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    results = (
        db.query(
            extract("month", Transaction.occurred_at).label("month"),
            func.sum(Transaction.amount).label("total"),
        )
        .filter(Transaction.user_id == current_user["user_id"])
        .filter(extract("year", Transaction.occurred_at) == year)
        .group_by(extract("month", Transaction.occurred_at))
        .order_by(extract("month", Transaction.occurred_at))
        .all()
    )

    return [
        {
            "month": int(r.month),
            "total": float(r.total),
        }
        for r in results
    ]


# ===============================
# 최근 12개월 소비
# ===============================
@router.get("/last-12-months")
def last_12_months(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now()
    one_year_ago = now - timedelta(days=365)

    results = (
        db.query(
            extract("year", Transaction.occurred_at).label("year"),
            extract("month", Transaction.occurred_at).label("month"),
            func.sum(Transaction.amount).label("total"),
        )
        .filter(Transaction.user_id == current_user["user_id"])
        .filter(Transaction.occurred_at >= one_year_ago)
        .group_by(
            extract("year", Transaction.occurred_at),
            extract("month", Transaction.occurred_at),
        )
        .order_by(
            extract("year", Transaction.occurred_at),
            extract("month", Transaction.occurred_at),
        )
        .all()
    )

    return [
        {
            "month": f"{int(r.year)}-{int(r.month):02d}",
            "total": float(r.total),
        }
        for r in results
    ]


# ===============================
# 거래 상세 조회
# ===============================
@router.get("/transactions/{tx_id}")
def get_transaction_detail(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    tx = (
        db.query(Transaction)
        .filter(Transaction.tx_id == tx_id)
        .filter(Transaction.user_id == current_user["user_id"])
        .first()
    )

    if not tx:
        raise HTTPException(status_code=404, detail="거래 없음")

    doc = getattr(tx, "document", None)

    return {
        "id": tx.tx_id,
        "amount": tx.amount,
        "category_id": tx.category_id,
        "memo": tx.memo,
        "occurred_at": tx.occurred_at.isoformat() if tx.occurred_at else None,
        "document_id": tx.document_id,
        "merchant_name": tx.merchant_name,
        "document_total_amount": doc.total_amount if doc else None,
        "document_occurred_at": doc.occurred_at.isoformat()
        if doc and doc.occurred_at
        else None,
    }
