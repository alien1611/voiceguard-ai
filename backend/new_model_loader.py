"""
VoiceGuard New Model Loader Compatibility Module
================================================
Re-exports authoritative ModelLoader as NewModelLoader for backwards compatibility.
"""

from backend.model_loader import ModelLoader as NewModelLoader, compute_sha256 as sha256_file, ModelLoader

__all__ = ["NewModelLoader", "ModelLoader", "sha256_file"]
