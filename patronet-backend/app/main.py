
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.addresses import router as addresses_router
from app.api.auth import router as auth_router
from app.api.cart import router as cart_router
from app.api.orders import router as orders_router
from app.api.products import router as products_router
from app.api.wishlist import router as wishlist_router

app = FastAPI(
    title="PATRONET API",
    description="Backend API for the PATRONET online store",
    version="1.0.0",
)

default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
env_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]
allowed_origins = list(dict.fromkeys(default_origins + env_origins))
cors_regex = os.getenv("CORS_ORIGIN_REGEX") or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(products_router)
app.include_router(auth_router)
app.include_router(addresses_router)
app.include_router(cart_router)
app.include_router(orders_router)
app.include_router(wishlist_router)


@app.get("/")
def home():
    return {
        "message": "Welcome to PATRONET API!",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "application": "PATRONET",
    }
