from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime

from app.models.transaction import Transaction
from app.models.category import Category


# 🔹 공통 월 범위 계산 함수
def _get_month_range():
    now = datetime.now()
    year = now.year
    month = now.month

    start_date = datetime(year, month, 1)

    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)

    return year, month, start_date, end_date


# 🔹 1️⃣ 월간 요약
def get_monthly_summary(db: Session, user_id: int):

    year, month, start_date, end_date = _get_month_range()

    summary = (
        db.query(
            func.coalesce(func.sum(Transaction.amount), 0).label("total"),
            func.count(Transaction.tx_id).label("count"),
        )
        .filter(Transaction.user_id == user_id)
        .filter(Transaction.occurred_at >= start_date)
        .filter(Transaction.occurred_at < end_date)
        .first()
    )

    top_category = (
        db.query(
            Category.name.label("category"),
            func.sum(Transaction.amount).label("total"),
        )
        .join(Transaction, Transaction.category_id == Category.category_id)
        .filter(Transaction.user_id == user_id)
        .filter(Transaction.occurred_at >= start_date)
        .filter(Transaction.occurred_at < end_date)
        .group_by(Category.name)
        .order_by(func.sum(Transaction.amount).desc())
        .first()
    )

    return {
        "year": year,
        "month": month,
        "total_amount": summary.total,
        "transaction_count": summary.count,
        "top_category": top_category.category if top_category else None,
    }


# 🔹 2️⃣ 카테고리 통계
def get_category_stats(db: Session, user_id: int):

    _, _, start_date, end_date = _get_month_range()

    results = (
        db.query(
            Category.name.label("category"),
            func.sum(Transaction.amount).label("total"),
        )
        .join(Transaction, Transaction.category_id == Category.category_id)
        .filter(Transaction.user_id == user_id)
        .filter(Transaction.occurred_at >= start_date)
        .filter(Transaction.occurred_at < end_date)
        .group_by(Category.name)
        .all()
    )

    return [
        {
            "category": row.category,
            "total_amount": row.total,
        }
        for row in results
    ]


# 🔹 3️⃣ 일별 통계
def get_daily_stats(db: Session, user_id: int):

    _, _, start_date, end_date = _get_month_range()

    results = (
        db.query(
            func.date(Transaction.occurred_at).label("date"),
            func.sum(Transaction.amount).label("total"),
        )
        .filter(Transaction.user_id == user_id)
        .filter(Transaction.occurred_at >= start_date)
        .filter(Transaction.occurred_at < end_date)
        .group_by(func.date(Transaction.occurred_at))
        .order_by(func.date(Transaction.occurred_at))
        .all()
    )

    return [
        {
            "date": str(row.date),
            "total_amount": row.total,
        }
        for row in results
    ]


# 🔹 4️⃣ 최근 거래
def get_recent_transactions(db: Session, user_id: int, limit: int = 5):

    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(desc(Transaction.occurred_at))
        .limit(limit)
        .all()
    )

    return [
        {
            "id": tx.tx_id,  # 모델 필드명에 맞춰 확인
            "amount": tx.amount,
            "category": tx.category.name if tx.category else None,
            "occurred_at": tx.occurred_at,
            "memo": tx.memo,
        }
        for tx in transactions
    ]