from sqlalchemy import Column, BigInteger, String, Integer, TIMESTAMP
from sqlalchemy.sql import func
from ..db.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(BigInteger, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)  

    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    name = Column(String(100))

    role = Column(String(20), default="USER")
    plan = Column(String(20), default="FREE")
    stripe_customer_id = Column(String(100))
    stripe_subscription_id = Column(String(100))
    subscription_status = Column(String(20), default="NONE")
    monthly_ocr_used = Column(Integer, default=0)
    status = Column(String(20), default="ACTIVE")

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())