"""VoiceGuard LFCC feature extraction module."""
import sys
import types

# Ensure ml package alias is registered so legacy imports resolve to project root
if "ml" not in sys.modules:
    from pathlib import Path
    _proj_root = Path(__file__).resolve().parent.parent
    ml_pkg = types.ModuleType("ml")
    ml_pkg.__path__ = [str(_proj_root)]
    sys.modules["ml"] = ml_pkg

from .lfcc_extractor import LFCCExtractor, LFCC_CONFIG
from .harmonized_lfcc import HarmonizedLFCCExtractor, HARMONIZED_LFCC_CONFIG

__all__ = [
    "LFCCExtractor",
    "LFCC_CONFIG",
    "HarmonizedLFCCExtractor",
    "HARMONIZED_LFCC_CONFIG",
]


