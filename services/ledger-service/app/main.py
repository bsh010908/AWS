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
from app.db.session import SessionLocal

from app.models.transaction import Transaction
from app.models.category import Category
from app.models.document import Document
from app.models.ocr_usage import OcrUsageMonthly
from app.models.budget import Budget

import time
from sqlalchemy import text

app = FastAPI()

DEFAULT_EXPENSE_CATEGORIES = ["식비", "교통", "쇼핑", "생활", "문화", "기타"]


def seed_default_categories():
    db = SessionLocal()
    try:
        existing = {
            row[0]
            for row in db.query(Category.name)
            .filter(Category.user_id == None, Category.is_active == True)
            .all()
        }
        missing = [name for name in DEFAULT_EXPENSE_CATEGORIES if name not in existing]

        if not missing:
            return

        for name in missing:
            db.add(Category(name=name, type="EXPENSE", user_id=None, is_active=True))
        db.commit()
        print(f"Seeded default categories: {', '.join(missing)}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


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
    seed_default_categories()


# ==========================
# CORS 설정
# ==========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://54.180.56.115",
        "https://y1g931km59.execute-api.ap-northeast-2.amazonaws.com",
        "http://ledger-alb-2037452529.ap-northeast-2.elb.amazonaws.com"

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
