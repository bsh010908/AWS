from sqlalchemy.orm import Session
from app.models.transaction import Transaction
from app.models.category import Category
from app.schemas.transaction_schema import TransactionCreate


def create_transaction(db: Session, user_id: int, data: TransactionCreate):

    category_obj = (
        db.query(Category)
        .filter(Category.name == data.category)
        .filter(Category.user_id == user_id)
        .first()
    )

    if not category_obj:
        category_obj = Category(
            user_id=user_id,
            name=data.category,
            type="EXPENSE",
            is_active=True,
        )
        db.add(category_obj)
        db.flush()

    new_tx = Transaction(
        user_id=user_id,
        amount=data.amount,
        category_id=category_obj.category_id,
        occurred_at=data.occurred_at,
    )

    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)

    return {
        "tx_id": new_tx.tx_id,
        "amount": new_tx.amount,
        "category": category_obj.name,
        "occurred_at": new_tx.occurred_at,
    }


def get_recent_transactions(db: Session, user_id: int):

    results = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.created_at.desc())
        .limit(5)
        .all()
    )

    return [
        {
            "tx_id": tx.tx_id,
            "amount": tx.amount,
            "category": tx.category.name,
            "occurred_at": tx.occurred_at
        }
        for tx in results
    ]