AUDIO DEEPFAKE DETECTOR — ML HANDOVER
======================================

1. PROJECT OVERVIEW
-------------------
Experimental binary audio classifier based on ASVspoof 2019 Logical Access (LA).

Classes:
- BONAFIDE (label 0): genuine audio
- SPOOF (label 1): spoofed audio

Audio is converted into LFCC features and passed to a PyTorch CNN.

IMPORTANT: This is an experimental baseline, not a production-ready vishing
detector. Official evaluation showed a noticeable performance gap compared
with the development sample, and some spoof attack categories were frequently
missed. Do not use it as the sole basis for security decisions.

2. REQUIRED FILES
-----------------
Keep these files together:

- predict.py
- cnn_model.py
- lfcc_extractor.py
- audio_preprocessing.py
- dataset_loader.py
- best_audio_cnn_22k.pth
- normalization_stats_22k.npz
- req.txt

The supplied lfcc_extractor.py imports load_protocol from dataset_loader.py.
That import is only used by its diagnostic section, but Python still needs
the module because it is imported at module load. If you remove that import
and the diagnostic __main__ section, dataset_loader.py and pandas are not
needed for inference.

3. INSTALLATION
---------------
Use a Python version compatible with the PyTorch build you install.

Install dependencies:

    python -m pip install --upgrade pip
    python -m pip install -r req.txt

For GPU inference, install a PyTorch build compatible with the teammate's
CUDA setup. CPU inference can be used if the prediction script supports
its CPU fallback.

4. RUNNING THE DETECTOR
-----------------------
From the folder containing predict.py, run:

    python predict.py

Enter the path to an audio file when prompted.

The current preprocessing expects 16 kHz audio, converts stereo to mono,
and pads or truncates it to 4 seconds.

5. LFCC CONFIGURATION
---------------------
- Sample rate: 16,000 Hz
- Frame length: 400 samples
- Hop length: 160 samples
- FFT size: 512
- Linear filters: 60
- Expected LFCC shape: (60, 398)

6. MODEL INPUT AND OUTPUT
-------------------------
The CNN input shape is:

    (batch_size, 1, 60, 398)

Normalization uses training-set mean and standard deviation stored in
normalization_stats_22k.npz. Do not calculate new normalization statistics
from the test recording or evaluation data.

The model returns a raw logit. The current prediction script uses threshold
0.0:
- raw_score >= 0.0: SPOOF
- raw_score < 0.0: BONAFIDE

The displayed spoof_score is the sigmoid of the raw logit. It is a model
score, not a calibrated real-world probability.

7. TRAINING AND EVALUATION NOTES
--------------------------------
Training sample:
- 22,000 recordings
- 2,000 bonafide
- 20,000 spoof
- 15 training epochs

Recorded official evaluation results at threshold 0.0:
- Accuracy: 74.51%
- Balanced accuracy: 85.40%
- ROC-AUC: 0.9586
- Equal Error Rate (EER): 10.26%

ROC-AUC is threshold-independent; it does not mean every attack type is
detected reliably. Results apply only to this dataset, implementation,
training sample, and evaluation setup.

8. LIMITATIONS
--------------
- The LFCC implementation is custom/educational and has not been proven
  equivalent to a standard reference LFCC implementation.
- The training data was a selected sample, not the full training partition.
- The development validation sample was small compared with official eval.
- The model showed a development-to-evaluation performance gap.
- It has not been validated against modern, independently collected
  voice-cloning or real-world vishing recordings.
- Do not describe spoof_score as the probability that a call is fraudulent.
- Do not use this model as the only fraud-prevention or identity-verification
  control.

9. DATASET
----------
The model was developed using ASVspoof 2019 LA. Follow the dataset's licence
and usage conditions. Do not redistribute dataset audio or protocol files
unless the applicable terms permit it.

10. HANDOVER CHECKLIST
----------------------
[ ] All required Python files are present.
[ ] best_audio_cnn_22k.pth is present.
[ ] normalization_stats_22k.npz is present.
[ ] Dependencies install successfully.
[ ] Prediction works on a known bonafide sample.
[ ] Prediction works on known spoof samples.
[ ] Teammates understand the model's limitations.
