from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import dashboard_router
from app.routers import transaction_router
from app.routers import receipt_router
from app.routers import category_router
from app.routers import ocr_usage_router
from app.routers import budget_router

from app.db.session import engine
from app.db.session import Base

from app.models.transaction import Transaction
from app.models.category import Category
from app.models.document import Document
from app.models.ocr_usage import OcrUsageMonthly
from app.models.budget import Budget

import time
from sqlalchemy import text

app = FastAPI()


# ==========================
# DB 준비 대기 + 테이블 생성
# ==========================
@app.on_event("startup")
def startup():

    # MySQL 준비될 때까지 대기
    for i in range(10):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("DB connected")
            break
        except Exception:
            print("DB not ready... retrying")
            time.sleep(3)

    # 테이블 생성
    Base.metadata.create_all(bind=engine)


# ==========================
# CORS 설정
# ==========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================
# 라우터 등록
# ==========================
app.include_router(budget_router.router)
app.include_router(dashboard_router.router)
app.include_router(transaction_router.router)
app.include_router(receipt_router.router)
app.include_router(category_router.router)
app.include_router(ocr_usage_router.router)