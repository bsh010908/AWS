from sqlalchemy import Column, BigInteger, String, TIMESTAMP, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base


class Category(Base):
    __tablename__ = "categories"

    category_id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, nullable=False, index=True)

    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False)  # EXPENSE / INCOME

    is_active = Column(Boolean, default=True)

    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)

    # 관계 설정
    transactions = relationship(
        "Transaction",
        back_populates="category",
        cascade="all, delete-orphan"
    )