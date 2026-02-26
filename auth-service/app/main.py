from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import auth_router
from .routers import billing_router

app = FastAPI()

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