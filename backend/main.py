from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import Base
from database import engine
from endpoints.vehicle import router as vehicle_router
from endpoints.driver import router as driver_router
from endpoints.stop import router as stop_router
from endpoints.path import router as path_router
from endpoints.route import router as route_router
from endpoints.daily_trip import router as daily_trip_router
from endpoints.deployment import router as deployment_router
from endpoints.movi import router as movi_router
from endpoints.voice import router as voice_router
import os
from dotenv import load_dotenv

load_dotenv()

# Create tables (only for SQLite, PostgreSQL should use migrations)
if os.getenv("DATABASE_URL", "").startswith("sqlite"):
    Base.metadata.create_all(bind=engine)

# Get environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

app = FastAPI(
    title="Move In Sync API",
    version="1.0.0",
    docs_url="/docs" if ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if ENVIRONMENT != "production" else None,
)

# Configure CORS based on environment
if ENVIRONMENT == "production":
    # Production: restrict to specific origins
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
    allowed_origins = [origin.strip() for origin in allowed_origins if origin.strip()]
    if not allowed_origins:
        allowed_origins = ["http://localhost:80", "https://yourdomain.com"]
else:
    # Development: allow all origins
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vehicle_router)
app.include_router(driver_router)
app.include_router(stop_router)
app.include_router(path_router)
app.include_router(route_router)
app.include_router(daily_trip_router)
app.include_router(deployment_router)
app.include_router(movi_router)
app.include_router(voice_router)

@app.get("/health")
def health_check():
    return {"status": "healthy"}