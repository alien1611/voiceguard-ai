"""
VoiceGuard AI — Full-Scale Dual-Strategy Model Trainer (Phase 7B)
=================================================================
Trains AudioCNN models using:
- Strategy A: Stratified Balanced Subset (5,160 samples: 2,580 bona fide + 2,580 spoof)
- Strategy B: Full Training Partition (25,380 samples: 2,580 bona fide + 22,800 spoof with pos_weight=0.11315)

Features:
- Variable-length LFCC inputs with batch_size=1 and gradient accumulation (N=16)
- Training-only normalization statistics computation
- Comprehensive validation on official development partition
- Early stopping (patience=5) based on validation EER / loss
- Saves checkpoints separately to cnn/checkpoints/ (NEVER overwriting best_audio_cnn.pth)
"""

import os
import sys
import csv
import time
import random
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset

# Ensure cnn directory is in sys.path
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
logger = logging.getLogger("FullTrainer")


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def compute_normalization_stats(
    records: List[dict],
    features_root: Path,
    output_path: Path
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Computes exact global normalization statistics (mean and std)
    across all frames of all training records using a streaming pass.
    Saves statistics as shape (1, 60, 1) to output_path (.npz).
    """
    logger.info("Computing normalization statistics across %d records...", len(records))
    t0 = time.perf_counter()

    sum_x = np.zeros(60, dtype=np.float64)
    sum_x2 = np.zeros(60, dtype=np.float64)
    total_frames = 0

    for idx, r in enumerate(records):
        fpath = features_root / r["feature_file"]
        if not fpath.exists():
            continue
        feat = np.load(str(fpath))  # shape [60, T]
        T = feat.shape[1]
        sum_x += feat.sum(axis=1, dtype=np.float64)
        sum_x2 += (feat ** 2).sum(axis=1, dtype=np.float64)
        total_frames += T

        if (idx + 1) % 5000 == 0:
            logger.info("Processed %d/%d files for statistics (%d total frames)", idx + 1, len(records), total_frames)

    mean = (sum_x / total_frames).astype(np.float32).reshape(1, 60, 1)
    variance = (sum_x2 / total_frames) - (mean.squeeze() ** 2)
    variance = np.maximum(variance, 1e-8)
    std = np.sqrt(variance).astype(np.float32).reshape(1, 60, 1)

    np.savez_compressed(str(output_path), mean=mean, std=std)
    elapsed = time.perf_counter() - t0
    logger.info(
        "Saved stats to %s (Frames: %d, Mean range: [%.2f, %.2f], Std range: [%.2f, %.2f]) in %.1fs",
        output_path.name, total_frames, mean.min(), mean.max(), std.min(), std.max(), elapsed
    )
    return mean, std


class VariableAudioDataset(Dataset):
    """Loads variable-length LFCC features directly from disk."""

    def __init__(
        self,
        records: List[dict],
        features_root: Path,
        mean: np.ndarray,
        std: np.ndarray
    ):
        self.records = records
        self.features_root = features_root
        self.mean = torch.from_numpy(mean.reshape(60, 1)).float()
        self.std = torch.from_numpy(std.reshape(60, 1)).float()

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor, dict]:
        r = self.records[idx]
        fpath = self.features_root / r["feature_file"]
        feat_np = np.load(str(fpath))  # shape [60, T]
        feat = torch.from_numpy(feat_np).float()
        
        # Apply normalization: broadcast [60, T] - [60, 1]
        norm_feat = (feat - self.mean) / (self.std + 1e-8)
        
        # Add batch & channel dims: [1, 1, 60, T]
        inp_tensor = norm_feat.unsqueeze(0).unsqueeze(0)
        label = torch.tensor([float(r["label"])], dtype=torch.float32)
        return inp_tensor, label, r


def compute_eer(bona_scores: np.ndarray, spoof_scores: np.ndarray) -> Tuple[float, float]:
    """Computes Equal Error Rate (EER) and optimal threshold."""
    from sklearn.metrics import roc_curve
    y_true = np.concatenate([np.zeros(len(bona_scores)), np.ones(len(spoof_scores))])
    y_scores = np.concatenate([bona_scores, spoof_scores])
    fpr, tpr, thresholds = roc_curve(y_true, y_scores, pos_label=1)
    fnr = 1 - tpr
    idx = np.nanargmin(np.abs(fnr - fpr))
    eer = (fpr[idx] + fnr[idx]) / 2.0
    threshold = thresholds[idx]
    return float(eer), float(threshold)


def evaluate_dataset(
    model: nn.Module,
    dataset: VariableAudioDataset,
    criterion: nn.Module,
    device: torch.device
) -> dict:
    """Evaluates the model on all samples of a dataset (e.g. Development partition)."""
    model.eval()
    total_loss = 0.0
    all_targets = []
    all_logits = []
    all_scores = []
    attack_scores: Dict[str, List[float]] = {}
    attack_targets: Dict[str, List[int]] = {}

    short_targets, short_preds = [], []
    long_targets, long_preds = [], []

    with torch.no_grad():
        for i in range(len(dataset)):
            inp, label, r = dataset[i]
            inp = inp.to(device)
            label = label.to(device)
            
            output = model(inp).squeeze(1)  # shape [1, 1] -> [1]
            loss = criterion(output, label)
            total_loss += loss.item()

            logit = output.item()
            score = torch.sigmoid(output).item()
            target = int(label.item())

            all_targets.append(target)
            all_logits.append(logit)
            all_scores.append(score)

            # Attack tracking
            att = r.get("attack_id", "-")
            if att not in attack_scores:
                attack_scores[att] = []
                attack_targets[att] = []
            attack_scores[att].append(score)
            attack_targets[att].append(target)

            # Duration tracking
            orig_dur = float(r.get("original_duration_sec", 4.0))
            pred = 1 if score >= 0.5 else 0
            if orig_dur < 4.0:
                short_targets.append(target)
                short_preds.append(pred)
            else:
                long_targets.append(target)
                long_preds.append(pred)

    avg_loss = total_loss / len(dataset)
    all_targets_np = np.array(all_targets)
    all_scores_np = np.array(all_scores)

    bona_scores = all_scores_np[all_targets_np == 0]
    spoof_scores = all_scores_np[all_targets_np == 1]

    eer, eer_threshold = compute_eer(bona_scores, spoof_scores)

    # Decisions at 0.50 threshold
    preds_05 = (all_scores_np >= 0.50).astype(int)
    from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix
    
    prec = precision_score(all_targets_np, preds_05, zero_division=0)
    rec = recall_score(all_targets_np, preds_05, zero_division=0)
    f1 = f1_score(all_targets_np, preds_05, zero_division=0)
    cm = confusion_matrix(all_targets_np, preds_05, labels=[0, 1])

    tn, fp, fn, tp = cm.ravel()
    fpr = fp / max(1, tn + fp)  # Bona fide false positive rate
    fnr = fn / max(1, tp + fn)  # Spoof false negative rate

    # Duration accuracies
    acc_short = np.mean(np.array(short_targets) == np.array(short_preds)) if short_targets else 0.0
    acc_long = np.mean(np.array(long_targets) == np.array(long_preds)) if long_targets else 0.0

    return {
        "loss": avg_loss,
        "eer": eer,
        "eer_threshold": eer_threshold,
        "precision": prec,
        "recall": rec,
        "f1": f1,
        "fpr": fpr,
        "fnr": fnr,
        "confusion_matrix": cm.tolist(),
        "acc_short": acc_short,
        "acc_long": acc_long,
        "attack_metrics": {
            att: {
                "count": len(attack_scores[att]),
                "mean_spoof_score": float(np.mean(attack_scores[att]))
            }
            for att in sorted(attack_scores.keys())
        }
    }


def train_model(
    strategy: str,
    train_records: List[dict],
    dev_records: List[dict],
    features_root: Path,
    output_checkpoint_path: Path,
    epochs: int = 20,
    accum_steps: int = 16,
    lr: float = 0.0005,
    patience: int = 5,
    seed: int = 42
) -> dict:
    set_seed(seed)
    device = torch.device("cpu")
    torch.set_num_threads(12)

    logger.info("=" * 70)
    logger.info("STARTING TRAINING: %s", strategy.upper())
    logger.info("Training records: %d | Dev records: %d", len(train_records), len(dev_records))
    logger.info("Target Checkpoint: %s", output_checkpoint_path)

    # 1. Compute & save normalization stats for this strategy
    stats_path = features_root / f"stats_{strategy}.npz"
    mean, std = compute_normalization_stats(train_records, features_root, stats_path)

    # 2. Datasets
    train_dataset = VariableAudioDataset(train_records, features_root, mean, std)
    dev_dataset = VariableAudioDataset(dev_records, features_root, mean, std)

    # 3. Model
    model = AudioCNN().to(device)

    # 4. Loss Function
    if strategy == "balanced":
        criterion = nn.BCEWithLogitsLoss()
        dev_criterion = nn.BCEWithLogitsLoss()
    elif strategy == "full_weighted":
        # Native ratio = 2580 bona / 22800 spoof = 0.11315
        pos_weight = torch.tensor([0.11315], device=device)
        criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
        dev_criterion = nn.BCEWithLogitsLoss()  # Evaluate dev on standard loss
    else:
        raise ValueError(f"Unknown strategy: {strategy}")

    # 5. Optimizer & Scheduler
    optimizer = optim.Adam(model.parameters(), lr=lr, betas=(0.9, 0.999), weight_decay=1e-5)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    best_dev_eer = float("inf")
    best_dev_loss = float("inf")
    best_epoch = 0
    patience_counter = 0
    best_metrics = {}

    output_checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, epochs + 1):
        model.train()
        epoch_loss = 0.0
        t0 = time.perf_counter()

        # Shuffle training indices reproducibly each epoch
        indices = list(range(len(train_dataset)))
        random.shuffle(indices)

        optimizer.zero_grad()
        accum_loss = 0.0

        for step, idx in enumerate(indices):
            inp, label, _ = train_dataset[idx]
            inp = inp.to(device)
            label = label.to(device)

            output = model(inp).squeeze(1)
            loss = criterion(output, label)

            # Scale loss by accumulation steps
            loss_scaled = loss / float(accum_steps)
            loss_scaled.backward()

            accum_loss += loss.item()
            epoch_loss += loss.item()

            if (step + 1) % accum_steps == 0 or (step + 1) == len(indices):
                optimizer.step()
                optimizer.zero_grad()

        avg_train_loss = epoch_loss / len(train_dataset)
        train_time = time.perf_counter() - t0

        # Run Validation on Development Partition
        t_val = time.perf_counter()
        dev_metrics = evaluate_dataset(model, dev_dataset, dev_criterion, device)
        val_time = time.perf_counter() - t_val

        scheduler.step()

        logger.info(
            "Epoch [%02d/%02d] (Train: %.1fs, Val: %.1fs) | Train Loss: %.4f | Dev Loss: %.4f | "
            "Dev EER: %.2f%% (Thresh: %.3f) | FPR: %.2f%% | FNR: %.2f%% | F1: %.4f",
            epoch, epochs, train_time, val_time, avg_train_loss, dev_metrics["loss"],
            dev_metrics["eer"] * 100.0, dev_metrics["eer_threshold"],
            dev_metrics["fpr"] * 100.0, dev_metrics["fnr"] * 100.0, dev_metrics["f1"]
        )

        # Early stopping & best checkpoint monitoring on Dev EER
        if dev_metrics["eer"] < best_dev_eer or (dev_metrics["eer"] == best_dev_eer and dev_metrics["loss"] < best_dev_loss):
            best_dev_eer = dev_metrics["eer"]
            best_dev_loss = dev_metrics["loss"]
            best_epoch = epoch
            best_metrics = dev_metrics
            patience_counter = 0

            # Save checkpoint atomically
            checkpoint_data = {
                "model_state_dict": model.state_dict(),
                "architecture": "AudioCNN",
                "mean": mean,
                "std": std,
                "strategy": strategy,
                "class_mapping": {0: "BONAFIDE", 1: "SPOOF"},
                "lfcc_coefficients": 60,
                "best_epoch": best_epoch,
                "best_dev_eer": best_dev_eer,
                "best_dev_loss": best_dev_loss,
                "best_threshold": dev_metrics["eer_threshold"],
                "validation_metrics": dev_metrics,
                "training_seed": seed,
                "training_samples": len(train_dataset),
            }
            tmp_pth = output_checkpoint_path.with_suffix(".tmp.pth")
            torch.save(checkpoint_data, str(tmp_pth))
            os.replace(str(tmp_pth), str(output_checkpoint_path))
            logger.info(">>> Best model saved at epoch %d with Dev EER: %.2f%%", epoch, best_dev_eer * 100.0)
        else:
            patience_counter += 1
            if patience_counter >= patience:
                logger.info("Early stopping triggered after %d epochs without improvement.", patience)
                break

    logger.info("Training %s complete. Best Epoch: %d | Best Dev EER: %.2f%%", strategy.upper(), best_epoch, best_dev_eer * 100.0)
    return best_metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VoiceGuard Full LA Trainer")
    parser.add_argument("--features-dir", type=str, default="features_full")
    parser.add_argument("--strategy", type=str, choices=["balanced", "full_weighted"], required=True)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--accum-steps", type=int, default=16)
    parser.add_argument("--lr", type=float, default=0.0005)
    parser.add_argument("--patience", type=int, default=5)
    parser.add_argument("--output", type=str, required=True)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    features_dir = Path(args.features_dir)
    train_meta_csv = features_dir / "metadata_train.csv"
    dev_meta_csv = features_dir / "metadata_dev.csv"

    # Read train metadata
    with open(train_meta_csv, "r", encoding="utf-8") as f:
        all_train = list(csv.DictReader(f))

    # Read dev metadata
    with open(dev_meta_csv, "r", encoding="utf-8") as f:
        all_dev = list(csv.DictReader(f))

    if args.strategy == "balanced":
        # Strategy A: 2,580 bona fide + 2,580 spoof (430 per attack A01-A06)
        bona = [r for r in all_train if r["label"] == "0"]
        random.seed(args.seed)
        
        spoof_by_attack = {}
        for r in all_train:
            if r["label"] == "1":
                att = r["attack_id"]
                spoof_by_attack.setdefault(att, []).append(r)
                
        selected_spoofs = []
        for att in sorted(spoof_by_attack.keys()):
            att_samples = spoof_by_attack[att]
            random.seed(args.seed)
            sampled = random.sample(att_samples, min(430, len(att_samples)))
            selected_spoofs.extend(sampled)
            
        train_records = bona + selected_spoofs
        random.seed(args.seed)
        random.shuffle(train_records)
        logger.info("Strategy A Prepared: %d Bona Fide, %d Spoof (Total: %d)", len(bona), len(selected_spoofs), len(train_records))
    else:
        # Strategy B: All 25,380 samples
        train_records = all_train
        logger.info("Strategy B Prepared: %d Total Training Samples", len(train_records))

    dev_records = all_dev
    output_path = Path(args.output)

    train_model(
        strategy=args.strategy,
        train_records=train_records,
        dev_records=dev_records,
        features_root=features_dir,
        output_checkpoint_path=output_path,
        epochs=args.epochs,
        accum_steps=args.accum_steps,
        lr=args.lr,
        patience=args.patience,
        seed=args.seed
    )
