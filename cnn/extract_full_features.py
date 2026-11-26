"""
VoiceGuard AI — Full Dataset Multiprocessing Feature Extractor (Phase 7B)
========================================================================
Extracts 60-coefficient LFCC features with native variable-length temporal dimensions.
Does NOT force 398 frames via zero-padding or circular repeat-padding.
Processes ASVspoof 2019 LA Training and Development partitions ONLY.
(Strictly excludes the Evaluation partition to prevent data leakage).

Utilizes multi-core parallel processing (12 CPU cores) for rapid extraction.
Resumable: Skips already-extracted recordings on disk.
"""

import os
import sys
import csv
import time
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from concurrent.futures import ProcessPoolExecutor, as_completed

import numpy as np
import soundfile as sf
import torch
import torchaudio.functional as F

try:
    import webrtcvad
    HAS_WEBRTC_VAD = True
except ImportError:
    HAS_WEBRTC_VAD = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("FeatureExtractor")

SAMPLE_RATE = 16000
FRAME_LENGTH = 400
HOP_LENGTH = 160
N_FFT = 512
NUM_FILTERS = 60
NUM_LFCC = 60
EPSILON = 1e-10
WINDOW_4S_SAMPLES = 64000


def extract_single_recording(
    rec: dict,
    audio_file_str: str,
    output_file_str: str
) -> dict:
    """Worker function to process one audio file independently."""
    audio_path = Path(audio_file_str)
    out_path = Path(output_file_str)

    if out_path.exists():
        # Already extracted
        return {
            "status": "skipped",
            "audio_id": rec["audio_id"],
            "speaker_id": rec["speaker_id"],
            "label": rec["label"],
            "key": rec["key"],
            "attack_id": rec["attack_id"]
        }

    try:
        audio, sr = sf.read(str(audio_path), dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        orig_dur = len(audio) / float(sr)

        # 1. Speech activity handling for audio > 4.0s
        total_samples = len(audio)
        if total_samples <= WINDOW_4S_SAMPLES:
            windowed = audio
            speech_ratio = 1.0
            method = "native"
        else:
            frame_sz = 320
            num_blocks = total_samples // frame_sz
            vad_obj = webrtcvad.Vad(2) if HAS_WEBRTC_VAD else None
            speech_flags = []
            
            if vad_obj is not None:
                scaled = np.clip(audio * 32767.0, -32768, 32767).astype(np.int16)
                for b in range(num_blocks):
                    pcm = scaled[b * frame_sz : (b + 1) * frame_sz].tobytes()
                    try:
                        speech_flags.append(1 if vad_obj.is_speech(pcm, SAMPLE_RATE) else 0)
                    except Exception:
                        speech_flags.append(0)
            else:
                speech_flags = [0] * num_blocks

            win_blocks = WINDOW_4S_SAMPLES // frame_sz  # 200 blocks
            total_speech = sum(speech_flags)

            if total_speech > 0 and num_blocks >= win_blocks:
                step_b = 25
                best_score = -1
                best_start_b = 0
                for sb in range(0, num_blocks - win_blocks + 1, step_b):
                    sc = sum(speech_flags[sb : sb + win_blocks])
                    if sc > best_score:
                        best_score = sc
                        best_start_b = sb
                s_samp = best_start_b * frame_sz
                windowed = audio[s_samp : s_samp + WINDOW_4S_SAMPLES]
                speech_ratio = round(best_score / float(win_blocks), 4)
                method = "webrtc_vad"
            else:
                # Energy fallback
                hop = 8000
                best_rms = -1.0
                best_s = 0
                for s in range(0, total_samples - WINDOW_4S_SAMPLES + 1, hop):
                    chk = audio[s : s + WINDOW_4S_SAMPLES]
                    rms = np.sqrt(np.mean(chk ** 2))
                    if rms > best_rms:
                        best_rms = rms
                        best_s = s
                windowed = audio[best_s : best_s + WINDOW_4S_SAMPLES]
                speech_ratio = 0.0
                method = "energy_fallback"

        # 2. Extract Variable LFCC using PyTorch
        w_tensor = torch.from_numpy(windowed).float()
        frames = w_tensor.unfold(dimension=-1, size=FRAME_LENGTH, step=HOP_LENGTH)
        win = torch.hamming_window(FRAME_LENGTH, periodic=False)
        spec = torch.fft.rfft(frames * win, n=N_FFT, dim=-1).abs().square()
        fb = F.linear_fbanks(N_FFT // 2 + 1, 0.0, SAMPLE_RATE / 2.0, NUM_FILTERS, SAMPLE_RATE)
        dct_mat = F.create_dct(NUM_LFCC, NUM_FILTERS, "ortho")
        lfcc = (torch.log(spec @ fb + EPSILON) @ dct_mat).transpose(-1, -2).numpy()

        # 3. Save .npy atomically
        tmp_path = out_path.with_suffix(".tmp.npy")
        np.save(str(tmp_path), lfcc)
        os.replace(str(tmp_path), str(out_path))

        return {
            "status": "success",
            "audio_id": rec["audio_id"],
            "speaker_id": rec["speaker_id"],
            "label": rec["label"],
            "key": rec["key"],
            "attack_id": rec["attack_id"],
            "original_duration_sec": round(orig_dur, 3),
            "processed_samples": len(windowed),
            "lfcc_frames": lfcc.shape[1],
            "vad_speech_ratio": speech_ratio,
            "framing_method": method,
            "feature_file": f"{out_path.parent.name}/{out_path.name}"
        }
    except Exception as exc:
        return {"status": "error", "audio_id": rec["audio_id"], "error": str(exc)}


def process_partition_parallel(
    split: str,
    protocol_path: Path,
    audio_dir: Path,
    output_dir: Path,
    max_workers: int = 8,
    max_records: Optional[int] = None
) -> Tuple[int, int, int]:
    """Processes a partition using parallel workers."""
    logger.info("=" * 70)
    logger.info("PROCESSING PARTITION: %s (Workers: %d)", split.upper(), max_workers)
    logger.info("Protocol: %s", protocol_path)
    logger.info("Audio Source: %s", audio_dir)

    split_out = output_dir / split
    split_out.mkdir(parents=True, exist_ok=True)
    meta_csv = output_dir / f"metadata_{split}.csv"

    # Read protocol
    records = []
    with open(protocol_path, "r", encoding="utf-8") as f:
        for line in f:
            p = line.strip().split()
            if len(p) == 5:
                records.append({
                    "speaker_id": p[0],
                    "audio_id": p[1],
                    "attack_id": p[3],
                    "key": p[4],
                    "label": 0 if p[4] == "bonafide" else 1
                })

    if max_records is not None:
        records = records[:max_records]

    total = len(records)
    logger.info("Total protocol records: %d", total)

    # Check already completed
    existing = set()
    if meta_csv.exists():
        with open(meta_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                existing.add(row["audio_id"])
        logger.info("Existing indexed records: %d", len(existing))

    fieldnames = [
        "audio_id", "speaker_id", "label", "key", "attack_id",
        "original_duration_sec", "processed_samples", "lfcc_frames",
        "vad_speech_ratio", "framing_method", "feature_file"
    ]
    
    file_mode = "a" if meta_csv.exists() else "w"
    meta_f = open(meta_csv, file_mode, newline="", encoding="utf-8")
    writer = csv.DictWriter(meta_f, fieldnames=fieldnames)
    if file_mode == "w":
        writer.writeheader()

    tasks = []
    skipped = 0
    for r in records:
        aid = r["audio_id"]
        out_f = split_out / f"{aid}.npy"
        if aid in existing and out_f.exists():
            skipped += 1
            continue
        tasks.append((r, str(audio_dir / f"{aid}.flac"), str(out_f)))

    logger.info("Tasks to execute: %d (Skipped existing: %d)", len(tasks), skipped)

    processed = 0
    insufficient = 0
    t0 = time.perf_counter()

    if tasks:
        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            future_map = {
                executor.submit(extract_single_recording, r, a_str, o_str): r["audio_id"]
                for r, a_str, o_str in tasks
            }
            
            for future in as_completed(future_map):
                res = future.result()
                if res["status"] == "success":
                    writer.writerow({k: res[k] for k in fieldnames})
                    processed += 1
                    if res["framing_method"] == "energy_fallback" and res["vad_speech_ratio"] == 0.0:
                        insufficient += 1
                    if processed % 1000 == 0:
                        meta_f.flush()
                        dt = time.perf_counter() - t0
                        rate = processed / max(0.1, dt)
                        logger.info(
                            "[%s] Completed %d/%d (%.1f%%) | Rate: %.1f files/s | ETA: %.1f min",
                            split.upper(), processed, len(tasks), (processed / len(tasks)) * 100.0,
                            rate, (len(tasks) - processed) / rate / 60.0
                        )
                elif res["status"] == "error":
                    logger.error("Error on %s: %s", res["audio_id"], res.get("error"))

    meta_f.flush()
    meta_f.close()

    total_time = time.perf_counter() - t0
    logger.info(
        "Finished %s in %.1fs: Processed: %d, Skipped: %d, Fallback framing: %d",
        split.upper(), total_time, processed, skipped, insufficient
    )
    return processed, skipped, insufficient


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="VoiceGuard Parallel Feature Extractor")
    parser.add_argument("--data-dir", type=str, default="datasets/LA")
    parser.add_argument("--output-dir", type=str, default="features_full")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--max-records", type=int, default=None)
    args = parser.parse_args()

    data_d = Path(args.data_dir)
    out_d = Path(args.output_dir)
    out_d.mkdir(parents=True, exist_ok=True)

    cm_proto = data_d / "ASVspoof2019_LA_cm_protocols"
    
    # 1. Train partition
    process_partition_parallel(
        "train",
        cm_proto / "ASVspoof2019.LA.cm.train.trn.txt",
        data_d / "ASVspoof2019_LA_train" / "flac",
        out_d,
        max_workers=args.workers,
        max_records=args.max_records
    )

    # 2. Dev partition
    process_partition_parallel(
        "dev",
        cm_proto / "ASVspoof2019.LA.cm.dev.trl.txt",
        data_d / "ASVspoof2019_LA_dev" / "flac",
        out_d,
        max_workers=args.workers,
        max_records=args.max_records
    )

    logger.info("Extraction pipeline finished successfully.")
