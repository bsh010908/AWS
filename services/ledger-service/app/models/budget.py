from sqlalchemy import Column, BigInteger, Integer, TIMESTAMP
from sqlalchemy.sql import func
from app.db.session import Base


class Budget(Base):

    __tablename__ = "budgets"

    budget_id = Column(BigInteger, primary_key=True, index=True)

    user_id = Column(BigInteger, nullable=False, index=True)

    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)

    amount = Column(BigInteger, nullable=False)

    created_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        nullable=False
    )