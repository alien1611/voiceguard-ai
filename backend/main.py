"""
VoiceGuard Local FastAPI Application
====================================
Main entry point for local AI voice spoof detection REST API.
Authoritative architecture: AudioCNN (ITW Speaker-Weighted) + 60-band LFCC.
"""

import json
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator, Union

from fastapi import FastAPI, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.audio_service import AudioService
from backend.config import (
    DEFAULT_THRESHOLD,
    DEFAULT_THRESHOLD_LOGIT,
    DURATION_SEC,
    EXPECTED_FEATURE_SHAPE,
    MODEL_PATH,
    NORMALIZATION_STATS_PATH,
    SAMPLE_RATE,
    TARGET_SAMPLES,
)
from backend.database.connection import DatabaseManager
from backend.database.detection_repository import DetectionRepository
from backend.inference import InferenceService
from backend.live_service import LiveAudioSession
from backend.model_loader import ModelLoader
from backend.routes.history import router as history_router
from backend.schemas import HealthResponse, ModelInfoResponse, PredictionResponse

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("voiceguard")

_START_TIME = time.time()


def get_inference_service() -> InferenceService:
    """Retrieve or initialize the authoritative InferenceService."""
    loader = ModelLoader.get_instance()
    if not loader.is_ready:
        loader.initialize()

    if not hasattr(app.state, "inference_service") or app.state.inference_service is None:
        audio_service = AudioService(target_sr=SAMPLE_RATE, target_samples=TARGET_SAMPLES)
        app.state.inference_service = InferenceService(
            model_loader=loader,
            audio_service=audio_service,
            threshold=loader.threshold,
        )
        app.state.model_loader = loader

    return app.state.inference_service


def get_legacy_inference_service() -> InferenceService:
    """Backwards compatibility helper: returns the authoritative inference service."""
    return get_inference_service()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup & shutdown lifecycle management."""
    logger.info("Initializing VoiceGuard backend with authoritative AudioCNN model...")
    try:
        service = get_inference_service()
        logger.info(
            "Authoritative AudioCNN and LFCCExtractor loaded successfully on device: %s",
            service.loader.device,
        )
    except Exception as exc:
        logger.error("CRITICAL: Failed to initialize authoritative model at startup: %s", exc)
        raise

    # Initialize local MongoDB indexes if database is available
    try:
        db_mgr = DatabaseManager.get_instance()
        health = db_mgr.check_health()
        if health["connected"]:
            db_mgr.init_indexes()
            logger.info("Local MongoDB connected at %s (latency: %s ms)", db_mgr.uri, health["ping_ms"])
        else:
            logger.info("Local MongoDB is offline. Predictions will operate in-memory without persistence.")
    except Exception as db_exc:
        logger.warning("Could not initialize MongoDB at startup: %s", db_exc)

    yield

    logger.info("Shutting down VoiceGuard backend.")
    try:
        DatabaseManager.get_instance().close()
    except Exception:
        pass


# Initialize FastAPI app
app = FastAPI(
    title="VoiceGuard – Local AI Voice Spoof Detector",
    description=(
        "Local API service for classifying human-generated (BONAFIDE) vs. "
        "AI-generated (SPOOF) voice recordings using a CNN trained on 60-band LFCC features."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# Register detection history and database routes
app.include_router(history_router)

# Configure CORS to permit local frontend access (React, Vue, Vite, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["General"])
async def root():
    """Service status and link to interactive API documentation."""
    return {
        "service": "VoiceGuard AI Voice Detection API",
        "status": "operational",
        "documentation": "/docs",
        "authoritative_model": MODEL_PATH.name,
        "endpoints": {
            "predict": "POST /api/predict",
            "health": "GET /api/health",
            "model_info": "GET /api/model-info",
            "history": "GET /api/history",
            "db_health": "GET /api/database/health",
            "live_ws": "WS /api/ws/live",
        }
    }


@app.get("/api/health", response_model=HealthResponse, tags=["Diagnostics"])
async def get_health():
    """Check health status of backend service and model readiness."""
    service = get_inference_service()
    loader = service.loader
    uptime = time.time() - _START_TIME
    is_ready = loader.is_ready

    return HealthResponse(
        status="healthy" if is_ready else "degraded",
        model_loaded=is_ready,
        device=str(loader.device),
        uptime_seconds=round(uptime, 1),
    )


@app.get("/api/model-info", response_model=ModelInfoResponse, tags=["Diagnostics"])
async def get_model_info():
    """Retrieve model technical specifications, input shapes, and decision threshold."""
    service = get_inference_service()
    loader = service.loader

    return ModelInfoResponse(
        model_name="AudioCNN (ITW Speaker-Weighted)",
        model_type="Convolutional Neural Network (3 Conv Blocks)",
        feature_extractor="VoiceGuard 60-Coefficient LFCC (SciPy DCT-II)",
        input_shape=[1, 1, EXPECTED_FEATURE_SHAPE[0], EXPECTED_FEATURE_SHAPE[1]],
        target_sample_rate_hz=SAMPLE_RATE,
        target_duration_sec=DURATION_SEC,
        target_samples=TARGET_SAMPLES,
        decision_threshold=round(loader.threshold, 4),
        classes={0: "BONAFIDE", 1: "SPOOF"},
        device=str(loader.device),
        checkpoint_file=MODEL_PATH.name,
        checkpoint_loaded=loader.is_ready,
    )


@app.post(
    "/api/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Detection"],
    summary="Predict whether an uploaded or recorded voice recording is Human (BONAFIDE) or AI-generated (SPOOF)",
)
async def predict_voice(
    file: UploadFile = File(..., description="Audio recording (.wav, .flac, .mp3, .ogg, .m4a, .webm)"),
    source: str = Query("upload", description="Audio source: 'upload' or 'recording'"),
):
    """
    Ingest, condition, and analyze an uploaded or recorded audio clip:
    1. Validates file header and size constraints.
    2. Decodes in-memory (WAV, MP3, FLAC, OGG) and converts multi-channel to mono.
    3. Resamples to 16 kHz and standardizes to 4.0 seconds (64,000 samples).
    4. Computes 60 x 398 Linear Frequency Cepstral Coefficients (LFCC).
    5. Normalizes against training statistics (normalization_stats_22k.npz).
    6. Runs authoritative AudioCNN forward inference.
    7. Returns predicted class, confidence, scores, and metadata.
    """
    inference_service: InferenceService = get_inference_service()

    try:
        content = await file.read()
    except Exception as exc:
        logger.error("Failed to read uploaded stream from '%s': %s", file.filename, exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read uploaded file payload."
        ) from exc

    try:
        filename = file.filename or ("recorded_audio.wav" if source == "recording" else "uploaded_audio.wav")
        result = inference_service.predict(content, filename, source=source)

        # Attempt to store detection record in local MongoDB
        try:
            repo = DetectionRepository()
            record = {
                "filename": filename,
                "file_extension": Path(filename).suffix.lower(),
                "source": source,
                "audio_duration_sec": result.audio_metadata.original_duration_sec,
                "original_sample_rate": result.audio_metadata.original_sample_rate,
                "target_sample_rate": SAMPLE_RATE,
                "predicted_class": result.predicted_class,
                "confidence": result.confidence,
                "bonafide_score": result.bonafide_score,
                "spoof_score": result.spoof_score,
                "raw_logit": getattr(result, "raw_logit", None),
                "processing_time_ms": result.processing_time_ms,
                "model_name": "AudioCNN (ITW Speaker-Weighted)",
                "model_version": MODEL_PATH.name,
                "audio_metadata": result.audio_metadata.model_dump() if hasattr(result.audio_metadata, "model_dump") else dict(result.audio_metadata),
                "model_info": {
                    "model_name": "AudioCNN (ITW Speaker-Weighted)",
                    "model_version": MODEL_PATH.name,
                    "lfcc_coefficients": 60,
                    "device": str(inference_service.loader.device),
                    "input_shape": [1, 1, EXPECTED_FEATURE_SHAPE[0], EXPECTED_FEATURE_SHAPE[1]],
                },
            }
            success, doc_id, err = repo.insert_detection(record)
            if success:
                result.detection_id = doc_id
                result.db_saved = True
            else:
                result.db_saved = False
                result.db_warning = f"Local database unavailable: {err}"
        except Exception as db_exc:
            logger.debug("Could not persist detection record: %s", db_exc)
            result.db_saved = False
            result.db_warning = f"Database error: {db_exc}"

        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected error processing '%s': %s", file.filename, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during audio feature extraction and inference."
        ) from exc
    finally:
        await file.close()


@app.websocket("/api/ws/live")
async def websocket_live_detection(websocket: WebSocket):
    """
    Real-time audio streaming WebSocket endpoint.
    Accepts raw 16 kHz float32/int16 PCM audio frames, detects speech activity (VAD),
    and evaluates 64,000-sample sliding windows through AudioCNN + 60-band LFCC.
    """
    await websocket.accept()
    session = LiveAudioSession()
    logger.info("Live WebSocket session connected: %s", session.session_id)

    try:
        await websocket.send_json({
            "type": "connected",
            "session_id": session.session_id,
            "threshold": session.threshold_logit,
            "sample_rate": SAMPLE_RATE,
            "window_seconds": DURATION_SEC,
            "message": "Connected to VoiceGuard Live Detection Engine",
        })

        while True:
            message = await websocket.receive()
            if "bytes" in message and message["bytes"]:
                # Binary audio chunk from microphone
                pcm_data = message["bytes"]
                session.append_audio_pcm(pcm_data, format_type="float32")
                events = session.process_available_windows()
                for event in events:
                    await websocket.send_json(event)

            elif "text" in message and message["text"]:
                try:
                    payload = json.loads(message["text"])
                    cmd_type = str(payload.get("type", "")).lower()

                    if cmd_type == "start":
                        sid = payload.get("session_id")
                        if sid:
                            session.session_id = sid
                            session.stats.session_id = sid
                        await websocket.send_json({
                            "type": "started",
                            "session_id": session.session_id,
                            "state": "LISTENING",
                            "message": "Live detection session started",
                        })

                    elif cmd_type == "stop":
                        summary = session.close_and_persist_summary()
                        await websocket.send_json({
                            "type": "session_stopped",
                            "state": "STOPPED",
                            "summary": summary,
                        })
                        break

                    elif cmd_type == "reset":
                        session.buffer = np.zeros(0, dtype=np.float32)
                        session.smoothed_spoof_score = None
                        await websocket.send_json({
                            "type": "reset",
                            "message": "Audio buffer and smoothing reset",
                        })

                    elif cmd_type == "ping":
                        await websocket.send_json({"type": "pong", "time": time.time()})

                except json.JSONDecodeError:
                    pass

    except WebSocketDisconnect:
        logger.info("Live WebSocket session disconnected: %s", session.session_id)
    except Exception as exc:
        logger.warning("Live WebSocket session '%s' error: %s", session.session_id, exc)
    finally:
        if session.is_active:
            session.close_and_persist_summary()


@app.post(
    "/api/predict/legacy",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Detection"],
    summary="Legacy prediction endpoint compatibility (routes strictly to authoritative model)",
)
async def predict_voice_legacy(
    file: UploadFile = File(..., description="Audio recording (.wav, .flac, .mp3, .ogg, .m4a, .webm)")
):
    """Routes legacy endpoint calls strictly to the authoritative AudioCNN pipeline."""
    return await predict_voice(file=file, source="upload")
