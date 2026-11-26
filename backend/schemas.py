"""
VoiceGuard Backend Pydantic Schemas
===================================
Request and response data models for the voice detection API.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AudioMetadata(BaseModel):
    """Metadata regarding the uploaded audio file and its conversion."""
    filename: str = Field(..., description="Original uploaded filename")
    original_sample_rate: int = Field(..., description="Source audio sample rate in Hz")
    original_channels: int = Field(..., description="Original channel count (1 for mono, 2 for stereo)")
    original_duration_sec: float = Field(..., description="Duration of original audio in seconds")
    processed_samples: int = Field(..., description="Final standardized sample count fed to model (64,000)")


class PredictionResponse(BaseModel):
    """Inference output for an uploaded audio recording."""
    predicted_class: str = Field(
        ...,
        description="Classification label: 'BONAFIDE' (Human) or 'SPOOF' (AI-generated)"
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score for the predicted class [0.0 - 1.0]"
    )
    bonafide_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Probability estimate that the audio is genuine human speech (1.0 - spoof_score)"
    )
    spoof_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Raw sigmoid model output indicating likelihood of being an AI deepfake/spoof"
    )
    threshold: float = Field(
        ...,
        description="Decision threshold used to separate BONAFIDE and SPOOF (default: 0.50)"
    )
    processing_time_ms: float = Field(
        ...,
        description="Total processing time in milliseconds including preprocessing, LFCC extraction and inference"
    )
    model_status: str = Field(
        default="operational",
        description="Operational status of the underlying CNN model"
    )
    raw_logit: Optional[float] = Field(
        default=None,
        description="Raw output logit from the CNN prior to sigmoid"
    )
    audio_metadata: AudioMetadata = Field(
        ...,
        description="Metadata extracted from the input audio file"
    )
    disclaimer: str = Field(
        default=(
            "Model scores represent uncalibrated sigmoid outputs from an ASVspoof-trained "
            "prototype CNN and should be interpreted as diagnostic indicators rather than absolute certainty."
        ),
        description="Important real-world interpretation disclaimer"
    )
    detection_id: Optional[str] = Field(
        None,
        description="Unique database identifier for this detection record if persisted"
    )
    source: str = Field(
        default="upload",
        description="Detection source: 'upload', 'recording', or 'live_detection'"
    )
    db_saved: bool = Field(
        default=False,
        description="Whether detection record was successfully stored in local MongoDB"
    )
    db_warning: Optional[str] = Field(
        None,
        description="Warning notice if database storage was skipped or unavailable"
    )


class DetectionRecord(BaseModel):
    """Stored acoustic detection record in MongoDB."""
    detection_id: str = Field(..., description="Unique detection identifier")
    id: Optional[str] = Field(None, description="Alias for detection_id")
    filename: str = Field(..., description="Original filename analyzed")
    file_extension: str = Field(default="", description="Original file extension")
    audio_duration_sec: Optional[float] = Field(None, description="Original audio duration in seconds")
    original_sample_rate: Optional[int] = Field(None, description="Input sampling rate in Hz")
    target_sample_rate: int = Field(default=16000, description="Conditioned sampling rate in Hz")
    predicted_class: str = Field(..., description="'BONAFIDE' or 'SPOOF'")
    confidence: float = Field(..., description="Prediction confidence score")
    bonafide_score: float = Field(..., description="Bonafide probability score")
    spoof_score: float = Field(..., description="Spoof probability score")
    raw_logit: Optional[float] = Field(None, description="Raw CNN logit before sigmoid")
    processing_time_ms: float = Field(..., description="Processing latency in ms")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp of analysis")
    created_at: Optional[str] = Field(None, description="Alias for timestamp")
    source: str = Field(default="upload", description="Detection source: 'upload', 'recording', or 'live_detection'")
    model_name: str = Field(default="AudioCNN")
    model_version: str = Field(default="best_audio_cnn.pth")
    audio_metadata: Optional[Dict[str, Any]] = Field(default=None, description="Detailed audio metadata")
    model_info: Optional[Dict[str, Any]] = Field(default=None, description="Model specifications")


class HistorySummary(BaseModel):
    """Aggregate detection counts across history collection."""
    total_detections: int = 0
    bonafide_count: int = 0
    spoof_count: int = 0
    latest_timestamp: Optional[str] = None


class HistoryListResponse(BaseModel):
    """Paginated detection history list."""
    items: List[DetectionRecord] = Field(default_factory=list)
    total_count: int = 0
    page: int = 1
    page_size: int = 10
    total_pages: int = 1
    summary: HistorySummary = Field(default_factory=HistorySummary)


class DatabaseHealthResponse(BaseModel):
    """Local MongoDB database connectivity and status."""
    status: str = Field(..., description="'connected' or 'unavailable'")
    connected: bool = Field(..., description="Whether MongoDB is actively reachable")
    database: str = Field(default="voiceguard_db")
    collection: str = Field(default="detection_history")
    ping_ms: Optional[float] = Field(None, description="Roundtrip ping latency in ms")
    error: Optional[str] = Field(None, description="Error details if connection failed")


class DeleteRecordResponse(BaseModel):
    """Confirmation of record deletion."""
    success: bool
    deleted: bool = True
    detection_id: str
    message: str


class ClearHistoryResponse(BaseModel):
    """Confirmation of clearing entire collection."""
    success: bool
    cleared: bool = True
    deleted_count: int
    message: str


class HealthResponse(BaseModel):
    """Health status of the API server and loaded model."""
    status: str = Field(..., description="Overall service status ('healthy' or 'degraded')")
    model_loaded: bool = Field(..., description="Whether the CNN checkpoint is loaded into memory")
    device: str = Field(..., description="Execution device in use ('cpu' or 'cuda')")
    uptime_seconds: float = Field(..., description="Server uptime in seconds")


class ModelInfoResponse(BaseModel):
    """Technical architecture and configuration metadata."""
    model_name: str = Field(default="AudioCNN")
    model_type: str = Field(default="Convolutional Neural Network")
    feature_extractor: str = Field(default="Harmonized 60-Coefficient LFCC (PyTorch)")
    input_shape: List[int] = Field(default=[1, 1, 60, 398])
    target_sample_rate_hz: int = Field(default=16000)
    target_duration_sec: float = Field(default=4.0)
    target_samples: int = Field(default=64000)
    decision_threshold: float = Field(default=0.50)
    classes: Dict[int, str] = Field(default={0: "BONAFIDE", 1: "SPOOF"})
    device: str = Field(...)
    checkpoint_file: str = Field(default="best_audio_cnn.pth")
    checkpoint_loaded: bool = Field(default=True)
