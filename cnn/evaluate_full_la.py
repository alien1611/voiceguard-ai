"""
VoiceGuard AI — Full Development Partition Benchmark & Evaluation (Phase 7B)
=============================================================================
Evaluates trained AudioCNN checkpoints on the official ASVspoof 2019 LA
Development partition (24,844 trials).

Outputs:
- EER (Equal Error Rate) & Calibrated Decision Threshold
- Bona fide FPR & Spoof FNR
- Precision, Recall, F1, Accuracy
- Confusion Matrix
- Per-attack performance (A01 - A06)
- Duration breakdown: Short (< 4.0s) vs. Long (>= 4.0s)
- Head-to-head comparison between Strategy A and Strategy B
"""

import sys
import csv
import time
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import (
    roc_curve,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    accuracy_score
)

# Ensure paths
_CNN_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _CNN_DIR.parent
for p in (str(_PROJECT_ROOT), str(_CNN_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from cnn_model import AudioCNN

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("DevBenchmark")


def compute_eer(bona_scores: np.ndarray, spoof_scores: np.ndarray) -> Tuple[float, float]:
    y_true = np.concatenate([np.zeros(len(bona_scores)), np.ones(len(spoof_scores))])
    y_scores = np.concatenate([bona_scores, spoof_scores])
    fpr, tpr, thresholds = roc_curve(y_true, y_scores, pos_label=1)
    fnr = 1 - tpr
    idx = np.nanargmin(np.abs(fnr - fpr))
    eer = (fpr[idx] + fnr[idx]) / 2.0
    threshold = thresholds[idx]
    return float(eer), float(threshold)


def benchmark_checkpoint(
    checkpoint_path: Path,
    features_dir: Path,
    metadata_csv: Path
) -> dict:
    logger.info("=" * 70)
    logger.info("BENCHMARKING CHECKPOINT: %s", checkpoint_path.name)
    
    # 1. Load checkpoint
    ckpt = torch.load(str(checkpoint_path), map_location="cpu")
    model = AudioCNN()
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    mean = torch.from_numpy(ckpt["mean"].reshape(60, 1)).float()
    std = torch.from_numpy(ckpt["std"].reshape(60, 1)).float()
    strategy = ckpt.get("strategy", "unknown")
    best_epoch = ckpt.get("best_epoch", 0)

    # 2. Read metadata
    with open(metadata_csv, "r", encoding="utf-8") as f:
        records = list(csv.DictReader(f))

    logger.info("Loaded %d dev records. Strategy: %s (Trained Epoch: %d)", len(records), strategy, best_epoch)

    all_targets = []
    all_scores = []
    all_logits = []
    
    attack_scores: Dict[str, List[float]] = {}
    attack_targets: Dict[str, List[int]] = {}

    short_targets, short_scores = [], []
    long_targets, long_scores = [], []

    t0 = time.perf_counter()
    with torch.no_grad():
        for idx, r in enumerate(records):
            fpath = features_dir / r["feature_file"]
            feat_np = np.load(str(fpath))
            feat = torch.from_numpy(feat_np).float()
            
            norm_feat = (feat - mean) / (std + 1e-8)
            inp = norm_feat.unsqueeze(0).unsqueeze(0)  # [1, 1, 60, T]
            
            out = model(inp).squeeze()
            logit = out.item()
            score = torch.sigmoid(out).item()
            target = int(r["label"])

            all_targets.append(target)
            all_scores.append(score)
            all_logits.append(logit)

            att = r.get("attack_id", "-")
            attack_scores.setdefault(att, []).append(score)
            attack_targets.setdefault(att, []).append(target)

            dur = float(r.get("original_duration_sec", 4.0))
            if dur < 4.0:
                short_targets.append(target)
                short_scores.append(score)
            else:
                long_targets.append(target)
                long_scores.append(score)

            if (idx + 1) % 5000 == 0:
                logger.info("Evaluated %d/%d dev trials (%.1f%%)", idx + 1, len(records), (idx + 1)/len(records)*100.0)

    eval_time = time.perf_counter() - t0
    y_true = np.array(all_targets)
    y_scores = np.array(all_scores)

    bona_scores = y_scores[y_true == 0]
    spoof_scores = y_scores[y_true == 1]

    eer, opt_thresh = compute_eer(bona_scores, spoof_scores)

    # Threshold operating points:
    # A. Default 0.50
    preds_05 = (y_scores >= 0.50).astype(int)
    cm_05 = confusion_matrix(y_true, preds_05, labels=[0, 1])
    tn5, fp5, fn5, tp5 = cm_05.ravel()
    fpr_05 = fp5 / max(1, tn5 + fp5)
    fnr_05 = fn5 / max(1, tp5 + fn5)
    acc_05 = accuracy_score(y_true, preds_05)
    prec_05 = precision_score(y_true, preds_05, zero_division=0)
    rec_05 = recall_score(y_true, preds_05, zero_division=0)
    f1_05 = f1_score(y_true, preds_05, zero_division=0)

    # B. Calibrated at EER Threshold
    preds_eer = (y_scores >= opt_thresh).astype(int)
    cm_eer = confusion_matrix(y_true, preds_eer, labels=[0, 1])
    tne, fpe, fne, tpe = cm_eer.ravel()
    fpr_eer = fpe / max(1, tne + fpe)
    fnr_eer = fne / max(1, tpe + fne)
    acc_eer = accuracy_score(y_true, preds_eer)

    # Attack breakdown
    attack_results = {}
    for att in sorted(attack_scores.keys()):
        scs = np.array(attack_scores[att])
        targs = np.array(attack_targets[att])
        preds = (scs >= opt_thresh).astype(int)
        if att == "-":
            # Bona fide
            acc = float(np.mean(preds == 0))
            attack_results["bonafide"] = {
                "count": len(scs),
                "accuracy": acc,
                "fpr": float(np.mean(preds == 1)),
                "mean_score": float(np.mean(scs))
            }
        else:
            acc = float(np.mean(preds == 1))
            attack_results[att] = {
                "count": len(scs),
                "accuracy": acc,
                "fnr": float(np.mean(preds == 0)),
                "mean_score": float(np.mean(scs))
            }

    # Duration breakdown (at EER threshold)
    short_preds = (np.array(short_scores) >= opt_thresh).astype(int)
    long_preds = (np.array(long_scores) >= opt_thresh).astype(int)
    acc_short = float(np.mean(np.array(short_targets) == short_preds))
    acc_long = float(np.mean(np.array(long_targets) == long_preds))

    return {
        "checkpoint": checkpoint_path.name,
        "strategy": strategy,
        "best_epoch": best_epoch,
        "eval_time_sec": eval_time,
        "eer": eer,
        "opt_threshold": opt_thresh,
        "default_05": {
            "accuracy": acc_05,
            "precision": prec_05,
            "recall": rec_05,
            "f1": f1_05,
            "fpr": fpr_05,
            "fnr": fnr_05,
            "confusion_matrix": cm_05.tolist()
        },
        "calibrated_eer": {
            "accuracy": acc_eer,
            "fpr": fpr_eer,
            "fnr": fnr_eer,
            "confusion_matrix": cm_eer.tolist()
        },
        "acc_short": acc_short,
        "acc_long": acc_long,
        "attack_breakdown": attack_results
    }


def main():
    parser = argparse.ArgumentParser(description="VoiceGuard Development Benchmark")
    parser.add_argument("--features-dir", type=str, default="features_full")
    parser.add_argument("--checkpoints", type=str, required=True, help="Comma-separated paths to checkpoints")
    args = parser.parse_args()

    features_dir = Path(args.features_dir)
    dev_meta = features_dir / "metadata_dev.csv"

    ckpt_paths = [Path(p.strip()) for p in args.checkpoints.split(",") if p.strip()]

    all_results = []
    for cp in ckpt_paths:
        if not cp.exists():
            logger.error("Checkpoint not found: %s", cp)
            continue
        res = benchmark_checkpoint(cp, features_dir, dev_meta)
        all_results.append(res)

    print("\n" + "=" * 95)
    print("VOICEGUARD AI — DEVELOPMENT PARTITION BENCHMARK RESULTS (24,844 TRIALS)")
    print("=" * 95)
    header = f"{'Checkpoint':<30} | {'Strategy':<14} | {'EER':<8} | {'Calib Thresh':<13} | {'Bona FPR':<10} | {'Spoof FNR':<10} | {'F1':<8}"
    print(header)
    print("-" * 95)
    for r in all_results:
        print(
            f"{r['checkpoint']:<30} | {r['strategy']:<14} | {r['eer']*100.0:<7.2f}% | "
            f"{r['opt_threshold']:<13.4f} | {r['calibrated_eer']['fpr']*100.0:<9.2f}% | "
            f"{r['calibrated_eer']['fnr']*100.0:<9.2f}% | {r['default_05']['f1']:<8.4f}"
        )
    print("=" * 95)


if __name__ == "__main__":
    main()
