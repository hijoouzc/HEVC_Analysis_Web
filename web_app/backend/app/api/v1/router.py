from fastapi import APIRouter
from app.api.v1.endpoints import jobs, checkpoints, hevc_spec

api_v1_router = APIRouter()

api_v1_router.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
api_v1_router.include_router(checkpoints.router, prefix="/checkpoints", tags=["Checkpoints"])
api_v1_router.include_router(hevc_spec.router, prefix="/hevc-spec", tags=["HEVC Specification"])
