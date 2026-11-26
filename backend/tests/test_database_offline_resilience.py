"""
VoiceGuard AI — Database Offline Graceful Degradation Test
==========================================================
Verifies that when MongoDB is completely offline or unreachable:
1. DatabaseManager handles connection timeouts gracefully without crashing.
2. DetectionRepository.insert_detection returns (False, None, error_message) cleanly.
3. DetectionRepository.list_detections returns empty items and zero counts safely.
4. Audio inference via POST /api/predict continues to succeed with HTTP 200,
   returning valid CNN predictions, confidence scores, and setting:
   - db_saved = False
   - db_warning = "..."
"""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.database.connection import DatabaseManager
from backend.database.detection_repository import DetectionRepository
from fastapi.testclient import TestClient
from backend.main import app


class TestDatabaseOfflineResilience(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def test_mock_offline_manager_health(self):
        """Simulate unreachable MongoDB host."""
        offline_mgr = DatabaseManager(
            uri="mongodb://127.0.0.1:29999",  # Unused port
            db_name="voiceguard_db",
            collection_name="detection_history",
            timeout_ms=500  # fast timeout
        )
        health = offline_mgr.check_health()
        self.assertFalse(health["connected"])
        self.assertEqual(health["status"], "unavailable")
        self.assertIsNotNone(health["error"])

    def test_mock_offline_repository_insert(self):
        """Ensure insert_detection fails gracefully without raising an exception."""
        offline_mgr = DatabaseManager(
            uri="mongodb://127.0.0.1:29999",
            timeout_ms=500
        )
        repo = DetectionRepository(db_manager=offline_mgr)
        success, doc_id, err = repo.insert_detection({
            "filename": "offline_test.wav",
            "predicted_class": "BONAFIDE",
            "confidence": 0.95
        })
        self.assertFalse(success)
        self.assertIsNone(doc_id)
        self.assertIsNotNone(err)

    def test_mock_offline_repository_list(self):
        """Ensure list_detections returns empty summary safely when offline."""
        offline_mgr = DatabaseManager(
            uri="mongodb://127.0.0.1:29999",
            timeout_ms=500
        )
        repo = DetectionRepository(db_manager=offline_mgr)
        items, count, pages, summary = repo.list_detections(page=1, page_size=10)
        self.assertEqual(items, [])
        self.assertEqual(count, 0)
        self.assertEqual(pages, 0)
        self.assertEqual(summary["total_detections"], 0)

    def test_predict_endpoint_with_offline_mongodb(self):
        """
        Verify that POST /api/predict still returns a valid HTTP 200 prediction
        with db_saved=False even when MongoDB cannot be reached.
        """
        import io
        import numpy as np
        import soundfile as sf

        # Generate in-memory 4-second WAV
        sr = 16000
        dur = 4.0
        t = np.linspace(0, dur, int(dur * sr), endpoint=False, dtype=np.float32)
        sig = 0.3 * np.sin(2 * np.pi * 300 * t, dtype=np.float32)
        buf = io.BytesIO()
        sf.write(buf, sig, sr, format="WAV")
        audio_bytes = buf.getvalue()

        # Mock DatabaseManager inside DetectionRepository to point to dead port
        offline_mgr = DatabaseManager(
            uri="mongodb://127.0.0.1:29999",
            timeout_ms=400
        )

        with patch("backend.main.DetectionRepository", return_value=DetectionRepository(db_manager=offline_mgr)):
            response = self.client.post(
                "/api/predict",
                files={"file": ("offline_test.wav", audio_bytes, "audio/wav")}
            )

            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertIn("predicted_class", data)
            self.assertIn("confidence", data)
            self.assertFalse(data["db_saved"])
            self.assertIsNotNone(data["db_warning"])
            self.assertIn("Local database unavailable", data["db_warning"])


if __name__ == "__main__":
    unittest.main()
