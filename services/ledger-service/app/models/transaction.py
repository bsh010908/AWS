from sqlalchemy import Column, BigInteger, Integer, TIMESTAMP, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base
from sqlalchemy.sql import func
from sqlalchemy import DateTime

class Transaction(Base):
    __tablename__ = "transactions"

    tx_id = Column(BigInteger, primary_key=True, index=True)

    user_id = Column(BigInteger, nullable=False, index=True)

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

    # 관계 설정
    category = relationship(
        "Category",
        back_populates="transactions"
    )