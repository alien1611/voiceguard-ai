"""
VoiceGuard Pytest Configuration & Namespace Resolver
=====================================================
Ensures that the root project packages (preprocessing, features, extraction)
are available under both standard and legacy 'ml' namespace imports.
"""

import sys
import types
from pathlib import Path

# Add project root to sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Setup 'ml' package alias so legacy imports resolve to project root
if "ml" not in sys.modules:
    ml_pkg = types.ModuleType("ml")
    ml_pkg.__path__ = [str(_PROJECT_ROOT)]
    sys.modules["ml"] = ml_pkg
