from sqlalchemy.orm import Session
from app.models.budget import Budget


def set_budget(db: Session, user_id: int, year: int, month: int, amount: int):

    budget = (
        db.query(Budget)
        .filter(
            Budget.user_id == user_id,
            Budget.year == year,
            Budget.month == month
        )
        .first()
    )

    if budget:
        budget.amount = amount
    else:
        budget = Budget(
            user_id=user_id,
            year=year,
            month=month,
            amount=amount
        )
        db.add(budget)

    db.commit()
    db.refresh(budget)

    return budget