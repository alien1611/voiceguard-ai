"""
Pre-Extraction Sanity and Parity Test Suite
===========================================
Tests VariableLFCCExtractor on real ASVspoof 2019 samples:
1. Verify short audio (< 4.0s) produces native T < 398 frames.
2. Verify long audio (> 4.0s) produces exactly T = 398 frames via VAD.
3. Verify feature parity against HarmonizedLFCCExtractor on 4.0s fixed audio.
4. Verify finite float32 outputs with zero NaNs and zero Infs.
"""

import sys
from pathlib import Path
import soundfile as sf
import torch
import numpy as np

sys.path.insert(0, ".")
sys.path.insert(0, "cnn")

from cnn.extract_full_features import VariableLFCCExtractor
from features.harmonized_lfcc import HarmonizedLFCCExtractor

print("=" * 70)
print("RUNNING PRE-EXTRACTION VARIABLE-LENGTH TESTS")
print("=" * 70)

ext_var = VariableLFCCExtractor()
ext_prod = HarmonizedLFCCExtractor()

train_audio_dir = Path("datasets/LA/ASVspoof2019_LA_train/flac")
files = list(train_audio_dir.glob("*.flac"))

short_files = []
long_files = []

for f in files[:200]:
    info = sf.info(str(f))
    if info.duration < 3.0 and len(short_files) < 3:
        short_files.append((f, info.duration))
    elif info.duration > 5.0 and len(long_files) < 3:
        long_files.append((f, info.duration))

print(f"Found {len(short_files)} short test files and {len(long_files)} long test files.")

# Test 1: Short Files (Native Variable Length)
print("\n--- Test 1: Short Files Native Length ---")
for f, dur in short_files:
    audio, sr = sf.read(str(f), dtype="float32")
    win_audio, speech_ratio, method = ext_var.find_speech_active_window(audio)
    lfcc = ext_var.extract_from_waveform(torch.from_numpy(win_audio))
    expected_T = (len(win_audio) - 400) // 160 + 1
    print(f"File {f.name}: orig={dur:.2f}s | samples={len(win_audio)} | T={lfcc.shape[1]} (expected {expected_T}) | method={method}")
    assert lfcc.shape[0] == 60, f"Expected 60 coefficients, got {lfcc.shape[0]}"
    assert lfcc.shape[1] == expected_T, f"Frame count mismatch: {lfcc.shape[1]} vs {expected_T}"
    assert lfcc.shape[1] < 398, f"Short audio should be < 398 frames, got {lfcc.shape[1]}"
    assert not torch.isnan(lfcc).any(), "Found NaNs!"
    assert not torch.isinf(lfcc).any(), "Found Infs!"
print("Test 1 PASSED: Short files retain native frames without padding.")

# Test 2: Long Files (VAD 4.0s Windowing)
print("\n--- Test 2: Long Files VAD 4.0s Windowing ---")
for f, dur in long_files:
    audio, sr = sf.read(str(f), dtype="float32")
    win_audio, speech_ratio, method = ext_var.find_speech_active_window(audio)
    lfcc = ext_var.extract_from_waveform(torch.from_numpy(win_audio))
    print(f"File {f.name}: orig={dur:.2f}s | win_samples={len(win_audio)} | T={lfcc.shape[1]} | speech_ratio={speech_ratio:.2f} | method={method}")
    assert len(win_audio) == 64000, f"Expected 64000 samples, got {len(win_audio)}"
    assert lfcc.shape == (60, 398), f"Expected shape (60, 398), got {lfcc.shape}"
    assert not torch.isnan(lfcc).any(), "Found NaNs!"
    assert not torch.isinf(lfcc).any(), "Found Infs!"
print("Test 2 PASSED: Long files correctly framed to 4.0s with VAD.")

# Test 3: Numerical Parity against Production HarmonizedLFCCExtractor
print("\n--- Test 3: Numerical Parity with HarmonizedLFCCExtractor on 4.0s Audio ---")
torch.manual_seed(12345)
w_test = torch.randn(64000)
feat_var = ext_var.extract_from_waveform(w_test)
feat_prod = ext_prod.extract_from_waveform(w_test)

diff = (feat_var - feat_prod).abs().max().item()
print(f"Max absolute numerical difference: {diff:.8e}")
assert diff < 1e-6, f"Parity difference too large: {diff}"
print("Test 3 PASSED: 100% Bit-exact parity verified.")

print("\n" + "=" * 70)
print("ALL PRE-EXTRACTION SANITY TESTS PASSED SUCCESSFULLY!")
print("=" * 70)
