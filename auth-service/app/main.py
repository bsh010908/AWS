from fastapi import FastAPI
from .routers import auth_router
from .routers import billing_router

app = FastAPI()

app.include_router(auth_router.router)
app.include_router(billing_router.router)