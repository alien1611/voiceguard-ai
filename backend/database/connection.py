"""
VoiceGuard Local MongoDB Connection Manager
===========================================
Manages thread-safe local MongoDB connections with automatic failover,
graceful timeouts, and index initialization.
"""

import logging
import time
from typing import Any, Dict, Optional
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, PyMongoError, ServerSelectionTimeoutError

from backend.config import (
    MONGODB_COLLECTION,
    MONGODB_DATABASE,
    MONGODB_TIMEOUT_MS,
    MONGODB_URI,
)

logger = logging.getLogger("voiceguard.database")


class DatabaseManager:
    """Singleton manager for local MongoDB client and collection operations."""

    _instance: Optional["DatabaseManager"] = None
    _client: Optional[MongoClient] = None

    def __init__(
        self,
        uri: Optional[str] = None,
        db_name: Optional[str] = None,
        collection_name: Optional[str] = None,
        timeout_ms: Optional[int] = None,
    ) -> None:
        self.uri = uri or MONGODB_URI
        self.db_name = db_name or MONGODB_DATABASE
        self.collection_name = collection_name or MONGODB_COLLECTION
        self.timeout_ms = timeout_ms if timeout_ms is not None else MONGODB_TIMEOUT_MS
        self._client: Optional[MongoClient] = None

    @classmethod
    def get_instance(cls) -> "DatabaseManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_client(self) -> Optional[MongoClient]:
        """Retrieve or create the PyMongo client with strict local timeout constraints."""
        if self._client is None:
            try:
                self._client = MongoClient(
                    self.uri,
                    serverSelectionTimeoutMS=self.timeout_ms,
                    connectTimeoutMS=self.timeout_ms,
                    socketTimeoutMS=self.timeout_ms,
                    timeoutMS=self.timeout_ms,
                    directConnection=True,
                )
            except Exception as exc:
                logger.warning("Could not initialize MongoDB client: %s", exc)
                return None
        return self._client

    def get_database(self) -> Optional[Database]:
        client = self.get_client()
        if client is not None:
            return client[self.db_name]
        return None

    def get_collection(self) -> Optional[Collection]:
        db = self.get_database()
        if db is not None:
            return db[self.collection_name]
        return None

    def check_health(self) -> Dict[str, Any]:
        """Perform active round-trip ping to verify local MongoDB health."""
        client = self.get_client()
        if client is None:
            return {
                "status": "unavailable",
                "connected": False,
                "database": self.db_name,
                "collection": self.collection_name,
                "ping_ms": None,
                "error": "Failed to create local MongoDB client instance.",
            }

        start_time = time.perf_counter()
        try:
            client.admin.command("ping", maxTimeMS=self.timeout_ms)
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            return {
                "status": "connected",
                "connected": True,
                "database": self.db_name,
                "collection": self.collection_name,
                "ping_ms": round(elapsed_ms, 2),
                "error": None,
            }
        except (ServerSelectionTimeoutError, ConnectionFailure) as exc:
            logger.debug("MongoDB connection unreachable at %s: %s", self.uri, exc)
            return {
                "status": "unavailable",
                "connected": False,
                "database": self.db_name,
                "collection": self.collection_name,
                "ping_ms": None,
                "error": f"Local MongoDB server offline at {self.uri}. Ensure mongod is running.",
            }
        except Exception as exc:
            logger.warning("Unexpected error checking MongoDB status: %s", exc)
            return {
                "status": "unavailable",
                "connected": False,
                "database": self.db_name,
                "collection": self.collection_name,
                "ping_ms": None,
                "error": str(exc),
            }

    def init_indexes(self) -> bool:
        """Create necessary performance indexes on the detection_history collection."""
        health = self.check_health()
        if not health["connected"]:
            return False

        try:
            coll = self.get_collection()
            if coll is not None:
                # 1. Unique index on detection_id for fast direct lookups
                coll.create_index("detection_id", unique=True)
                # 2. Descending index on timestamp for newest-first pagination
                coll.create_index([("timestamp", -1)])
                # 3. Index on predicted_class for class filtering
                coll.create_index("predicted_class")
                logger.info("Successfully initialized MongoDB indexes on collection '%s'", self.collection_name)
                return True
        except Exception as exc:
            logger.warning("Could not initialize MongoDB indexes: %s", exc)
        return False

    def close(self) -> None:
        """Close client connection cleanly."""
        if self._client is not None:
            self._client.close()
            self._client = None
            logger.info("Closed MongoDB client connection.")
