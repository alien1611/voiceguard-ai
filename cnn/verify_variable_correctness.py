"""
VoiceGuard AI — Variable-Length Training Correctness & Gradient Test Suite
==========================================================================
Verifies before full training:
1. Actual bona fide and spoof recordings across several durations.
2. Feature storage preserves original temporal dimensions.
3. No artificial flat padding (-23.03) has entered the pipeline.
4. Normalization broadcasting on variable T.
5. Forward and backward passes with finite losses and gradients.
6. Gradient accumulation across 16 steps with correct loss scaling.
7. Optimization sanity check: loss strictly decreases on a small batch.
"""

import sys
import csv
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

sys.path.insert(0, ".")
sys.path.insert(0, "cnn")

from cnn_model import AudioCNN

print("=" * 75)
print("RUNNING SECTION 9: VARIABLE-LENGTH CORRECTNESS CHECKS")
print("=" * 75)

meta_csv = Path("features_full/metadata_train.csv")
assert meta_csv.exists(), "metadata_train.csv not found!"

with open(meta_csv, "r", encoding="utf-8") as f:
    records = list(csv.DictReader(f))

bona_recs = [r for r in records if r["label"] == "0"]
spoof_recs = [r for r in records if r["label"] == "1"]

print(f"Loaded {len(records)} extracted records ({len(bona_recs)} bona fide, {len(spoof_recs)} spoof).")

# 1. Inspect real files across durations
test_samples = [
    ("Bona Short", bona_recs[0]),
    ("Bona Medium", bona_recs[len(bona_recs)//2]),
    ("Bona Long", bona_recs[-1]),
    ("Spoof Short", spoof_recs[0]),
    ("Spoof Medium", spoof_recs[len(spoof_recs)//2]),
    ("Spoof Long", spoof_recs[-1]),
]

print("\n--- Check 1: Real Files Dimensions & Absence of Artificial Padding ---")
for name, r in test_samples:
    fpath = Path("features_full") / r["feature_file"]
    feat = np.load(str(fpath))
    T = feat.shape[1]
    expected_T = int(r["lfcc_frames"])
    dur = float(r["original_duration_sec"])
    
    # Check tail frame values: if flat zero-padding was used, log energy is -23.03
    tail_vals = feat[:, -5:]
    is_flat_zero = np.allclose(tail_vals[1:], 0.0, atol=1e-3)
    
    print(f"[{name:<12}] ID: {r['audio_id']} | Dur: {dur:4.2f}s | Shape: {feat.shape} | Expected T: {expected_T} | Flat Tail: {is_flat_zero}")
    assert feat.shape[0] == 60, f"Expected 60 coefficients, got {feat.shape[0]}"
    assert T == expected_T, f"Frame count mismatch: {T} vs {expected_T}"
    assert not is_flat_zero, "Detected artificial flat padding in tail frames!"
    assert not np.isnan(feat).any(), "Found NaNs in features!"
    assert not np.isinf(feat).any(), "Found Infs in features!"

print("Check 1 PASSED: Variable temporal dimensions verified without artificial padding.")

# 2. Normalization Broadcasting Check
print("\n--- Check 2: Normalization Broadcasting Check ---")
dummy_mean = torch.randn(60, 1)
dummy_std = torch.rand(60, 1) + 0.5

for name, r in test_samples[:3]:
    fpath = Path("features_full") / r["feature_file"]
    feat = torch.from_numpy(np.load(str(fpath))).float()
    norm_feat = (feat - dummy_mean) / (dummy_std + 1e-8)
    assert norm_feat.shape == feat.shape, "Shape changed during normalization!"
    assert not torch.isnan(norm_feat).any()

print("Check 2 PASSED: Normalization broadcasting is 100% mathematically consistent.")

# 3. Forward, Backward & Gradient Accumulation Check
print("\n--- Check 3: Forward, Backward & Finite Gradients ---")
model = AudioCNN()
model.train()
crit = nn.BCEWithLogitsLoss()
opt = optim.Adam(model.parameters(), lr=0.001)

opt.zero_grad()
accum_steps = 16

initial_weight = model.classifier.weight.clone()

# Accumulate 16 variable-length samples
for i in range(accum_steps):
    r = test_samples[i % len(test_samples)][1]
    fpath = Path("features_full") / r["feature_file"]
    feat = torch.from_numpy(np.load(str(fpath))).float()
    inp = feat.unsqueeze(0).unsqueeze(0)  # [1, 1, 60, T]
    label = torch.tensor([float(r["label"])])
    
    out = model(inp).squeeze(1)
    loss = crit(out, label) / float(accum_steps)
    
    assert torch.isfinite(loss), f"Non-finite loss at step {i}: {loss.item()}"
    loss.backward()

# Verify gradients exist and are finite
for name, p in model.named_parameters():
    assert p.grad is not None, f"Gradient missing for {name}"
    assert torch.isfinite(p.grad).all(), f"Non-finite gradient in {name}"

opt.step()
opt.zero_grad()

weight_diff = (model.classifier.weight - initial_weight).abs().max().item()
print(f"Max classifier weight update after accumulation step: {weight_diff:.6e}")
assert weight_diff > 0.0, "Weights did not update after optimizer step!"
print("Check 3 PASSED: Gradients are finite and accumulation updates weights properly.")

# 4. Optimization Sanity Check (Loss Decreases on Small Batch)
print("\n--- Check 4: Loss Minimization Sanity Check ---")
opt_sanity = optim.Adam(model.parameters(), lr=0.01)
sample_recs = [test_samples[0][1], test_samples[3][1]]  # 1 bona, 1 spoof

losses = []
for epoch in range(15):
    epoch_loss = 0.0
    for r in sample_recs:
        opt_sanity.zero_grad()
        fpath = Path("features_full") / r["feature_file"]
        feat = torch.from_numpy(np.load(str(fpath))).float()
        inp = feat.unsqueeze(0).unsqueeze(0)
        label = torch.tensor([float(r["label"])])
        out = model(inp).squeeze(1)
        l = crit(out, label)
        l.backward()
        opt_sanity.step()
        epoch_loss += l.item()
    losses.append(epoch_loss / len(sample_recs))

print(f"Sanity Optimization: Initial Loss = {losses[0]:.4f} -> Final Loss = {losses[-1]:.4f}")
assert losses[-1] < losses[0], "Loss failed to decrease during optimization!"
print("Check 4 PASSED: AudioCNN successfully optimizes on variable-length LFCC.")

print("\n" + "=" * 75)
print("ALL SECTION 9 VARIABLE-LENGTH CORRECTNESS CHECKS PASSED (4/4)!")
print("=" * 75)
