from sqlalchemy import Column, BigInteger, String, Integer, TIMESTAMP
from sqlalchemy.sql import func
from app.db.session import Base


class OcrUsageMonthly(Base):
    __tablename__ = "ocr_usage_monthly"

    user_id = Column(BigInteger, primary_key=True)
    yyyymm = Column(String(6), primary_key=True)

    used_count = Column(Integer, nullable=False, default=0)

    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )