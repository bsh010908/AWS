from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import auth_router
from .routers import billing_router

from .db.database import Base, engine
from .models.user import User

import time
from sqlalchemy import text

app = FastAPI()


# ==========================
# DB 준비 대기 + 테이블 생성
# ==========================
@app.on_event("startup")
def startup():

    for i in range(10):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("DB connected")
            break
        except Exception:
            print("DB not ready... retrying")
            time.sleep(3)

    Base.metadata.create_all(bind=engine)


# ==========================
# CORS 설정
# ==========================
origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================
# 라우터 등록
# ==========================
app.include_router(auth_router.router)
app.include_router(billing_router.router)