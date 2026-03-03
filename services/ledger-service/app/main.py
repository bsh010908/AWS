from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import dashboard_router
from app.routers import transaction_router
from app.routers import receipt_router
from app.routers import category_router
from app.routers import ocr_usage_router

app = FastAPI()

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

app.include_router(dashboard_router.router)
app.include_router(transaction_router.router)
app.include_router(receipt_router.router)
app.include_router(category_router.router)
app.include_router(ocr_usage_router.router)