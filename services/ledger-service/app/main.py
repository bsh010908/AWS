from fastapi import FastAPI
from app.routers import test_router

app = FastAPI()

app.include_router(test_router.router)