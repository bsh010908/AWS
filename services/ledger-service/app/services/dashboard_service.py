from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from app.models.transaction import Transaction


def get_monthly_summary(db: Session, user_id: int):
    now = datetime.now()
    year = now.year
    month = now.month

    total = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(Transaction.user_id == user_id)
        .filter(func.year(Transaction.occurred_at) == year)
        .filter(func.month(Transaction.occurred_at) == month)
        .scalar()
    )

    return {
        "year": year,
        "month": month,
        "total_amount": total
    }