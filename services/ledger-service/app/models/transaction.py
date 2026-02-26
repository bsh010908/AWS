from sqlalchemy import Column, BigInteger, Integer, TIMESTAMP, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base


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

    created_at = Column(TIMESTAMP)

    # 관계 설정
    category = relationship(
        "Category",
        back_populates="transactions"
    )