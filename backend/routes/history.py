"""
VoiceGuard Detection History Routes
===================================
FastAPI endpoints for querying, managing, and deleting local MongoDB
acoustic detection records.
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from backend.database.connection import DatabaseManager
from backend.database.detection_repository import DetectionRepository
from backend.schemas import (
    ClearHistoryResponse,
    DatabaseHealthResponse,
    DeleteRecordResponse,
    DetectionRecord,
    HistoryListResponse,
    HistorySummary,
)

logger = logging.getLogger("voiceguard.routes.history")

router = APIRouter(prefix="/api", tags=["Detection History"])
repo = DetectionRepository()
db_manager = DatabaseManager.get_instance()


@router.get(
    "/database/health",
    response_model=DatabaseHealthResponse,
    summary="Check local MongoDB database connection status",
)
async def get_database_health() -> DatabaseHealthResponse:
    """Return live status of local MongoDB connection and ping latency."""
    health = db_manager.check_health()
    return DatabaseHealthResponse(**health)


@router.get(
    "/history",
    response_model=HistoryListResponse,
    summary="Retrieve paginated detection history",
)
async def list_detection_history(
    page: int = Query(1, ge=1, description="Page index (1-based)"),
    page_size: int = Query(10, ge=1, le=100, description="Records per page (max 100)"),
    class_filter: Optional[str] = Query(
        None,
        description="Filter by classification result: 'BONAFIDE', 'SPOOF', or None for all",
    ),
    source_filter: Optional[str] = Query(
        None,
        description="Filter by detection source: 'upload', 'recording', 'live_detection', or None for all",
    ),
) -> HistoryListResponse:
    """
    Fetch historical voice detection records sorted newest-first with summary metrics.
    Gracefully returns empty list if database is unreachable.
    """
    items, total_count, total_pages, summary = repo.list_detections(
        page=page, page_size=page_size, class_filter=class_filter, source_filter=source_filter
    )

    records = [DetectionRecord(**item) for item in items]
    summary_model = HistorySummary(**summary)

    return HistoryListResponse(
        items=records,
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        summary=summary_model,
    )


@router.get(
    "/history/{detection_id}",
    response_model=DetectionRecord,
    summary="Get single detection record details",
)
async def get_detection_record(detection_id: str) -> DetectionRecord:
    """Fetch complete metadata and probability scores for a specific detection ID."""
    doc = repo.get_detection(detection_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Detection record '{detection_id}' was not found in local database.",
        )
    return DetectionRecord(**doc)


@router.delete(
    "/history/{detection_id}",
    response_model=DeleteRecordResponse,
    summary="Delete single detection record",
)
async def delete_detection_record(detection_id: str) -> DeleteRecordResponse:
    """Permanently delete a specific detection record by detection ID."""
    success = repo.delete_detection(detection_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Could not delete: record '{detection_id}' not found or database unreachable.",
        )
    return DeleteRecordResponse(
        success=True,
        detection_id=detection_id,
        message=f"Detection record '{detection_id}' was successfully deleted.",
    )


@router.delete(
    "/history",
    response_model=ClearHistoryResponse,
    summary="Clear all detection history records",
)
async def clear_all_history() -> ClearHistoryResponse:
    """
    Permanently clear all records in the detection_history collection.
    Requires explicit user confirmation on the frontend.
    """
    deleted_count = repo.clear_all()
    return ClearHistoryResponse(
        success=True,
        deleted_count=deleted_count,
        message=f"Successfully cleared {deleted_count} detection records from local database.",
    )
