from sqlalchemy import Column, BigInteger, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class Category(Base):
    __tablename__ = "categories"

    category_id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    user_id = Column(BigInteger, nullable=True, index=True)

    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False)  # EXPENSE / INCOME

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    transactions = relationship(
        "Transaction",
        back_populates="category",
        cascade="all, delete-orphan"
    )