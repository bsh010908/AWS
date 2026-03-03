from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.session import get_db
from app.models.transaction import Transaction
from app.services.dashboard_service import (
    get_monthly_summary,
    get_category_stats,
    get_daily_stats,
    get_recent_transactions,
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
# 통합 대시보드 (가장 중요)
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
# 월 요약 (단독 호출용)
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
# 최근 거래 목록
# ===============================
@router.get("/recent")
def recent_transactions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_recent_transactions(db, current_user)

# ===============================
# 🔥 AI 인사이트 전용 API
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

        # OCR 문서
        "document_id": tx.document_id,
        "merchant_name": doc.merchant_name if doc else None,
        "document_total_amount": doc.total_amount if doc else None,
        "document_occurred_at": doc.occurred_at.isoformat()
        if doc and doc.occurred_at
        else None,
    }


