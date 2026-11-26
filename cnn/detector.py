
from pathlib import Path

import numpy as np
import torch

from cnn_model import AudioCNN
from lfcc_extractor import extract_lfcc


class VoiceSpoofDetector:

    def __init__(self, threshold=0.5):

        self.base_dir = Path(__file__).resolve().parent
        self.threshold = threshold

        # Select computing device
        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        # Load normalisation statistics
        stats_path = self.base_dir / "normalized_train.npz"

        if not stats_path.exists():
            raise FileNotFoundError(stats_path)

        stats = np.load(stats_path)

        self.mean = stats["mean"].reshape(60, 1)
        self.std = stats["std"].reshape(60, 1)

        # Load trained model (with fallback to new active VoiceGuard model)
        model_path = self.base_dir / "best_audio_cnn.pth"
        if not model_path.exists():
            model_path = self.base_dir.parent / "voiceguard_integration" / "models" / "best_audio_cnn_itw_speaker_weighted.pth"

        if not model_path.exists():
            raise FileNotFoundError(model_path)

        self.model = AudioCNN().to(self.device)

        self.model.load_state_dict(
            torch.load(model_path, map_location=self.device)
        )

        self.model.eval()

    def predict(self, audio_path):

        audio_path = Path(audio_path)

        if not audio_path.exists():
            raise FileNotFoundError(audio_path)

        # Extract LFCC features
        features = extract_lfcc(audio_path)

        if features.shape[0] != 60:
            raise ValueError(
                f"Expected 60 LFCC coefficients, got {features.shape}"
            )

        # Apply training normalisation
        features = (features - self.mean) / (self.std + 1e-8)

        features = features.astype(np.float32)

        # Convert to CNN input format:
        # (1, 1, 60, number_of_frames)
        input_tensor = torch.from_numpy(features)
        input_tensor = input_tensor.unsqueeze(0).unsqueeze(0)
        input_tensor = input_tensor.to(self.device)

        # Model inference
        with torch.no_grad():
            logit = self.model(input_tensor)
            spoof_score = torch.sigmoid(logit).item()

        prediction = (
            "SPOOF"
            if spoof_score >= self.threshold
            else "BONAFIDE"
        )

        return {
            "file": audio_path.name,
            "prediction": prediction,
            "spoof_score": spoof_score,
            "threshold": self.threshold
        }
