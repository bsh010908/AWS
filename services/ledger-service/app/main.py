from fastapi import FastAPI
from app import models
from app.routers import dashboard_router
from app.routers import transaction_router
from fastapi.middleware.cors import CORSMiddleware
from app.routers import receipt_router

app = FastAPI()

app.include_router(dashboard_router.router)
app.include_router(transaction_router.router)
app.include_router(receipt_router.router)



app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)