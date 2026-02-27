from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime

from app.models.transaction import Transaction
from app.models.category import Category


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


def get_monthly_summary(db: Session, current_user: dict):

    user_id = current_user["user_id"]
    plan = current_user["plan"]

    year, month, start_date, end_date = _get_month_range()

    current_summary = (
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

    response = {
        "year": year,
        "month": month,
        "total_amount": current_summary.total,
        "transaction_count": current_summary.count,
        "top_category": top_category.category if top_category else None,
    }

    if plan == "PRO":

        if month == 1:
            prev_year = year - 1
            prev_month = 12
        else:
            prev_year = year
            prev_month = month - 1

        prev_start = datetime(prev_year, prev_month, 1)

        if prev_month == 12:
            prev_end = datetime(prev_year + 1, 1, 1)
        else:
            prev_end = datetime(prev_year, prev_month + 1, 1)

        prev_total = (
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(Transaction.user_id == user_id)
            .filter(Transaction.occurred_at >= prev_start)
            .filter(Transaction.occurred_at < prev_end)
            .scalar()
        )

        if prev_total == 0:
            change_rate = 100 if current_summary.total > 0 else 0
        else:
            change_rate = round(
                ((current_summary.total - prev_total) / prev_total) * 100,
                1,
            )

        response.update(
            {
                "last_month_total": prev_total,
                "change_rate": change_rate,
            }
        )

    return response


def get_category_stats(db: Session, current_user: dict):

    user_id = current_user["user_id"]

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


def get_daily_stats(db: Session, current_user: dict):

    user_id = current_user["user_id"]

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


def get_recent_transactions(
    db: Session,
    current_user: dict,
    limit: int = 5,
):

    user_id = current_user["user_id"]

    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(desc(Transaction.occurred_at))
        .limit(limit)
        .all()
    )

    return [
        {
            "id": tx.tx_id,
            "amount": tx.amount,
            "category": tx.category.name if tx.category else None,
            "occurred_at": tx.occurred_at,
            "memo": tx.memo,
        }
        for tx in transactions
    ]