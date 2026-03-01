from sqlalchemy import Column, BigInteger, Integer, String, Text, TIMESTAMP, DECIMAL
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class Document(Base):
    __tablename__ = "documents"

    document_id = Column(BigInteger, primary_key=True, index=True)

    user_id = Column(BigInteger, nullable=False)

    input_type = Column(String(20), nullable=False)

    s3_bucket = Column(String(255))
    s3_key = Column(String(255))

    raw_text = Column(Text)
    extracted_text = Column(Text)

    merchant_name = Column(String(255))
    total_amount = Column(Integer)

    occurred_at = Column(TIMESTAMP)

    ai_category_id = Column(BigInteger)
    ai_confidence = Column(DECIMAL(4, 3))

    status = Column(String(20), nullable=False, default="UPLOADED")

    created_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        nullable=False
    )

    # 🔥 Transaction 역관계
    transactions = relationship(
        "Transaction",
        back_populates="document"
    )