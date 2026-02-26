from fastapi import FastAPI
from app.routers import test_router
from app import models
from app.routers import dashboard_router


app = FastAPI()

app.include_router(test_router.router)
app.include_router(dashboard_router.router)