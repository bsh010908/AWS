from fastapi import FastAPI
from app import models
from app.routers import dashboard_router
from app.routers import transaction_router


app = FastAPI()

app.include_router(dashboard_router.router)
app.include_router(transaction_router.router)