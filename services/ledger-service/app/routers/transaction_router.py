from fastapi import APIRouter, Depends, Query, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from fastapi import Body
from sqlalchemy.orm import joinedload
import csv
from io import StringIO

from app.db.session import get_db
from app.core.security import get_current_user
from app.schemas.transaction_schema import (
    TransactionCreate,
    TransactionResponse,
)
from app.services.transaction_service import create_transaction
from app.models.transaction import Transaction


router = APIRouter(prefix="/ledger/transactions", tags=["transactions"])


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
    source_type: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]

    start_date, end_date = _build_month_range(year, month)

    query = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .options(joinedload(Transaction.document))
        .filter(Transaction.user_id == user_id)
        .filter(Transaction.occurred_at >= start_date)
        .filter(Transaction.occurred_at < end_date)
    )

    if source_type:
        query = query.filter(Transaction.source_type == source_type)

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
            "merchant_name": tx.merchant_name,
            "memo": tx.memo,
            "source_type": tx.source_type,   # 🔥 추가
            "ai_confidence": (
                float(tx.document.ai_confidence)
                if tx.source_type == "OCR" and tx.document and tx.document.ai_confidence is not None
                else None
        ),
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
# 최근 추가 영수증
# ===============================
@router.get("/recent")
def get_recent_transactions(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    user_id = current_user["user_id"]

    txs = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .options(joinedload(Transaction.document))
        .filter(Transaction.user_id == user_id)
        .order_by(desc(Transaction.created_at))
        .limit(limit)
        .all()
    )

    return [
        {
            "id": tx.tx_id,
            "amount": tx.amount,
            "category": tx.category.name if tx.category else None,
            "occurred_at": tx.occurred_at.isoformat() if tx.occurred_at else None,
            "merchant_name": tx.merchant_name,
            "memo": tx.memo,
            "source_type": tx.source_type,
            "ai_confidence": (
                float(tx.document.ai_confidence)
                if tx.source_type == "OCR" and tx.document and tx.document.ai_confidence is not None
                else None
            ),
        }
        for tx in txs
    ]


# ===============================
# 거래 CSV 내보내기
# ===============================
@router.get("/export/csv")
def export_transactions_csv(
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]

    query = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.user_id == user_id)
    )

    if year is not None and month is not None:
        start_date, end_date = _build_month_range(year, month)
        query = query.filter(Transaction.occurred_at >= start_date)
        query = query.filter(Transaction.occurred_at < end_date)

    txs = query.order_by(desc(Transaction.occurred_at)).all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "occurred_at",
            "amount",
            "category",
            "merchant_name",
            "memo",
            "source_type",
        ]
    )

    for tx in txs:
        writer.writerow(
            [
                tx.tx_id,
                tx.occurred_at.isoformat() if tx.occurred_at else "",
                tx.amount,
                tx.category.name if tx.category else "",
                tx.merchant_name or "",
                tx.memo or "",
                tx.source_type or "",
            ]
        )

    if year is not None and month is not None:
        filename = f"transactions_{year}_{str(month).zfill(2)}.csv"
    else:
        filename = "transactions_all.csv"

    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

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

    return {
        "id": tx.tx_id,
        "amount": tx.amount,
        "category_id": tx.category_id,
        "memo": tx.memo,
        "merchant_name": tx.merchant_name,
        "occurred_at": tx.occurred_at.isoformat()
        if tx.occurred_at
        else None,
    }


# ===============================
# 거래 삭제
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


# ===============================
# 거래 수정
# ===============================
@router.put("/{tx_id}")
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

    if "memo" in payload:
        tx.memo = payload["memo"]

    if "category_id" in payload:
        tx.category_id = payload["category_id"]

    if "amount" in payload:
        tx.amount = int(payload["amount"])

    if "occurred_at" in payload:
        tx.occurred_at = datetime.fromisoformat(payload["occurred_at"])

    if "merchant_name" in payload:
        tx.merchant_name = payload["merchant_name"]

    db.commit()

    return {"message": "수정 완료"}
