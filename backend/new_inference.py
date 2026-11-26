"""
VoiceGuard New Inference Service Compatibility Module
=====================================================
Re-exports authoritative InferenceService as NewInferenceService for backwards compatibility.
"""

from backend.inference import InferenceService as NewInferenceService, InferenceService

__all__ = ["NewInferenceService", "InferenceService"]
