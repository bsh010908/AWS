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
)
from app.core.security import get_current_user


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# 🔹 월 기본값 계산용 함수
def _resolve_year_month(year: int | None, month: int | None):
    now = datetime.now()
    return year or now.year, month or now.month


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
# 최근 거래 목록
# ===============================
@router.get("/recent")
def recent_transactions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_recent_transactions(db, current_user)


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
        # Transaction
        "id": tx.tx_id,
        "amount": tx.amount,
        "category_id": tx.category_id,
        "memo": tx.memo,
        "occurred_at": tx.occurred_at,

        # Document (OCR 결과)
        "document_id": tx.document_id,
        "merchant_name": doc.merchant_name if doc else None,
        "document_total_amount": doc.total_amount if doc else None,
        "document_occurred_at": doc.occurred_at if doc else None,

        # 호환용(기존 프론트에서 merchant 쓰면 안 깨지게)
        "merchant": doc.merchant_name if doc else None,
    }


# ===============================
# 거래 수정 (Transaction + Document)
# ===============================
@router.put("/transactions/{tx_id}")
def update_transaction(
    tx_id: int,
    payload: dict = Body(...),
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

    # ===== Transaction 수정 =====
    if "memo" in payload:
        tx.memo = payload["memo"]

    if "category_id" in payload:
        tx.category_id = payload["category_id"]

    if "amount" in payload:
        try:
            amount = int(payload["amount"])
        except Exception:
            raise HTTPException(status_code=400, detail="amount는 정수여야 합니다")
        if amount < 0:
            raise HTTPException(status_code=400, detail="amount는 0 이상이어야 합니다")
        tx.amount = amount

    if "occurred_at" in payload:
        # "2026-02-27" 또는 "2026-02-27T12:30:00" 지원
        try:
            tx.occurred_at = datetime.fromisoformat(payload["occurred_at"])
        except Exception:
            raise HTTPException(status_code=400, detail="occurred_at 형식이 올바르지 않습니다(ISO)")

    # ===== Document(OCR 결과) 수정 =====
    doc = getattr(tx, "document", None)
    if doc:
        if "merchant_name" in payload:
            doc.merchant_name = payload["merchant_name"]

        if "document_total_amount" in payload:
            try:
                doc.total_amount = int(payload["document_total_amount"])
            except Exception:
                raise HTTPException(status_code=400, detail="document_total_amount는 정수여야 합니다")

        if "document_occurred_at" in payload:
            try:
                doc.occurred_at = datetime.fromisoformat(payload["document_occurred_at"])
            except Exception:
                raise HTTPException(status_code=400, detail="document_occurred_at 형식이 올바르지 않습니다(ISO)")

    db.commit()

    return {"message": "수정 완료"}