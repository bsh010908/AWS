from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime

from app.db.session import get_db
from app.core.security import get_current_user
from app.schemas.transaction_schema import (
    TransactionCreate,
    TransactionResponse,
)
from app.services.transaction_service import create_transaction
from app.models.transaction import Transaction


router = APIRouter(prefix="/transactions", tags=["transactions"])


# ===============================
# 월 범위 계산
# ===============================
def _build_month_range(year: int, month: int):
    start_date = datetime(year, month, 1)

    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)

    return start_date, end_date


# ===============================
# 거래 생성
# ===============================
@router.post("", response_model=TransactionResponse)
def create_tx(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return create_transaction(
        db,
        current_user["user_id"],
        data
    )


# ===============================
# 거래 목록 조회 (페이징)
# ===============================
@router.get("")
def get_transactions(
    year: int = Query(...),
    month: int = Query(...),
    page: int = Query(0, ge=0),
    size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]

    start_date, end_date = _build_month_range(year, month)

    query = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .filter(Transaction.occurred_at >= start_date)
        .filter(Transaction.occurred_at < end_date)
    )

    total_elements = query.count()

    transactions = (
        query.order_by(desc(Transaction.occurred_at))
        .offset(page * size)
        .limit(size)
        .all()
    )

    content = [
        {
            "id": tx.tx_id,
            "amount": tx.amount,
            "category": tx.category.name if tx.category else None,
            "occurred_at": tx.occurred_at.isoformat()
            if tx.occurred_at
            else None,
            "merchant_name": (
                tx.document.merchant_name
                if tx.document and tx.document.merchant_name
                else None
            ),
            "memo": tx.memo,
        }
        for tx in transactions
    ]

    return {
        "total_elements": total_elements,
        "total_pages": (total_elements + size - 1) // size,
        "page": page,
        "size": size,
        "content": content,
    }


# ===============================
# 거래 상세 조회
# ===============================
@router.get("/{tx_id}")
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

    doc = tx.document

    return {
        "id": tx.tx_id,
        "amount": tx.amount,
        "category_id": tx.category_id,
        "memo": tx.memo,
        "occurred_at": tx.occurred_at.isoformat()
        if tx.occurred_at
        else None,

        "document_id": tx.document_id,
        "merchant_name": doc.merchant_name if doc else None,
        "document_total_amount": doc.total_amount if doc else None,
        "document_occurred_at": doc.occurred_at.isoformat()
        if doc and doc.occurred_at
        else None,
    }


# ===============================
# 거래 삭제 (선택 추가)
# ===============================
@router.delete("/{tx_id}")
def delete_transaction(
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

    db.delete(tx)
    db.commit()

    return {"message": "삭제 완료"}