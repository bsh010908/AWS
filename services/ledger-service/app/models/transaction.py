from sqlalchemy import Column, BigInteger, Integer, TIMESTAMP, String, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.session import Base
from sqlalchemy.sql import func
from sqlalchemy import DateTime


class Transaction(Base):
    __tablename__ = "transactions"

    __table_args__ = (
        Index("idx_user_date", "user_id", "occurred_at"),
    )

    tx_id = Column(BigInteger, primary_key=True, index=True)

    user_id = Column(BigInteger, nullable=False, index=True)

    document_id = Column(
        BigInteger,
        ForeignKey("documents.document_id"),
        nullable=True
    )

    category_id = Column(
        BigInteger,
        ForeignKey("categories.category_id"),
        nullable=False
    )

    amount = Column(Integer, nullable=False)

    occurred_at = Column(TIMESTAMP, nullable=False, index=True)

    memo = Column(String(255))

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )

    category = relationship("Category", back_populates="transactions")
    document = relationship("Document", back_populates="transactions")