"""
VoiceGuard Detection Repository
===============================
Data access layer for persisting, querying, and managing acoustic voice
detection history in local MongoDB.
"""

import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from backend.database.connection import DatabaseManager

logger = logging.getLogger("voiceguard.repository")


class DetectionRepository:
    """Repository handling CRUD operations for voice detection history."""

    def __init__(self, db_manager: Optional[DatabaseManager] = None) -> None:
        self.manager = db_manager or DatabaseManager.get_instance()

    def insert_detection(self, data: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Store a completed audio detection record in local MongoDB.
        Returns: (success: bool, detection_id: str, error_message: str | None)
        """
        health = self.manager.check_health()
        if not health["connected"]:
            return False, None, f"Local database unavailable: {health.get('error') or 'Database offline'}"

        coll = self.manager.get_collection()
        if coll is None:
            return False, None, "Database collection is unavailable."

        detection_id = data.get("detection_id") or f"det_{uuid.uuid4().hex[:12]}"
        timestamp = data.get("timestamp") or datetime.now(timezone.utc).isoformat()

        document = {
            "detection_id": detection_id,
            "id": detection_id,
            "filename": data.get("filename", "unknown_audio"),
            "file_extension": data.get("file_extension", ""),
            "audio_duration_sec": data.get("audio_duration_sec"),
            "original_sample_rate": data.get("original_sample_rate"),
            "target_sample_rate": data.get("target_sample_rate", 16000),
            "predicted_class": data.get("predicted_class", "UNKNOWN"),
            "confidence": float(data.get("confidence", 0.0)),
            "bonafide_score": float(data.get("bonafide_score", 0.0)),
            "spoof_score": float(data.get("spoof_score", 0.0)),
            "raw_logit": float(data.get("raw_logit", 0.0)) if data.get("raw_logit") is not None else None,
            "processing_time_ms": float(data.get("processing_time_ms", 0.0)),
            "source": data.get("source", "upload"),
            "timestamp": timestamp,
            "created_at": timestamp,
            "model_name": data.get("model_name", "AudioCNN"),
            "model_version": data.get("model_version", "best_audio_cnn.pth"),
            "audio_metadata": data.get("audio_metadata"),
            "model_info": data.get("model_info"),
        }

        try:
            coll.insert_one(document)
            logger.info("Saved detection record '%s' for '%s'", detection_id, document["filename"])
            return True, detection_id, None
        except Exception as exc:
            logger.warning("Failed to save detection record: %s", exc)
            return False, None, str(exc)

    def get_detection(self, detection_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve single detection record by its unique detection_id."""
        coll = self.manager.get_collection()
        if coll is None:
            return None

        try:
            doc = coll.find_one({"detection_id": detection_id}, {"_id": 0})
            if doc:
                doc["id"] = doc.get("detection_id")
                doc["created_at"] = doc.get("timestamp")
                doc.setdefault("source", "upload")
            return doc
        except Exception as exc:
            logger.warning("Error fetching detection '%s': %s", detection_id, exc)
            return None

    def list_detections(
        self,
        page: int = 1,
        page_size: int = 10,
        class_filter: Optional[str] = None,
        source_filter: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int, int, Dict[str, Any]]:
        """
        Retrieve paginated detection history, reverse-chronological order,
        alongside global summary metrics. Supports filtering by class and source.
        Returns: (items, total_count, total_pages, summary_metrics)
        """
        empty_summary = {
            "total_detections": 0,
            "bonafide_count": 0,
            "spoof_count": 0,
            "latest_timestamp": None,
        }

        coll = self.manager.get_collection()
        if coll is None:
            return [], 0, 0, empty_summary

        try:
            query: Dict[str, Any] = {}
            if class_filter and class_filter.upper() in ("BONAFIDE", "SPOOF"):
                query["predicted_class"] = class_filter.upper()
            if source_filter and source_filter.lower() in ("upload", "recording", "live_detection"):
                query["source"] = source_filter.lower()

            total_count = coll.count_documents(query)
            total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1
            safe_page = max(1, min(page, total_pages if total_count > 0 else 1))
            skip = (safe_page - 1) * page_size

            cursor = (
                coll.find(query, {"_id": 0})
                .sort("timestamp", -1)
                .skip(skip)
                .limit(page_size)
            )
            items = list(cursor)
            for item in items:
                item["id"] = item.get("detection_id")
                item["created_at"] = item.get("timestamp")
                item.setdefault("source", "upload")

            # Calculate global summary statistics
            total_global = coll.count_documents({})
            bonafide_global = coll.count_documents({"predicted_class": "BONAFIDE"})
            spoof_global = coll.count_documents({"predicted_class": "SPOOF"})
            
            latest_doc = coll.find_one({}, {"_id": 0, "timestamp": 1}, sort=[("timestamp", -1)])
            latest_timestamp = latest_doc["timestamp"] if latest_doc else None

            summary = {
                "total_detections": total_global,
                "bonafide_count": bonafide_global,
                "spoof_count": spoof_global,
                "latest_timestamp": latest_timestamp,
            }

            return items, total_count, total_pages, summary
        except Exception as exc:
            logger.warning("Error listing detections: %s", exc)
            return [], 0, 0, empty_summary

    def delete_detection(self, detection_id: str) -> bool:
        """Delete a single detection record by its unique detection_id."""
        coll = self.manager.get_collection()
        if coll is None:
            return False

        try:
            result = coll.delete_one({"detection_id": detection_id})
            return result.deleted_count > 0
        except Exception as exc:
            logger.warning("Error deleting detection '%s': %s", detection_id, exc)
            return False

    def clear_all(self) -> int:
        """Clear all records from detection_history collection."""
        coll = self.manager.get_collection()
        if coll is None:
            return 0

        try:
            result = coll.delete_many({})
            logger.info("Cleared %d records from detection_history", result.deleted_count)
            return result.deleted_count
        except Exception as exc:
            logger.warning("Error clearing detection history: %s", exc)
            return 0
