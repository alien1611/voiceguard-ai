# Architecture

The package is a local Python library with no web server, database, UI, account
system, or outbound notification mechanism.

```text
WAV/MP3/FLAC/OGG/AIFF file ─┐
External PCM/audio chunks ──┼─> decode/downmix/resample/pad/crop
Optional sounddevice input ─┘                 │
                                              v
                                      16 kHz, 4 s mono
                                              │
                                              v
                                60-filter LFCC, shape (60, 398)
                                              │
                                              v
                           matched normalization + speaker-weighted CNN
                                              │
                        raw logit + sigmoid model score + fixed threshold
                                              │
                           moving average / EMA / persistence / hysteresis
                                              │
                     provisional risk / structured alerts / recommendations
```

`model_loader.py` validates artifact names, checkpoint and normalization hashes,
metadata, LFCC settings, and the raw-logit threshold before loading the model.
`detector.py` owns file prediction and independent session state. Each session
has a separate fixed-capacity mono ring buffer, smoother, and lock;
`live_engine.py` accepts arbitrary chunk sources and optionally adapts a
microphone via `sounddevice`. `risk_engine.py`, `alert_manager.py`, and
`prevention_policy.py` do not control calls or contact users. The host
application decides how to present or act on events.

The per-window raw model output is retained even when smoothing changes the
stable assessment. HIGH/CRITICAL raw evidence is not discarded by earlier
genuine-looking windows. Smoothing and persistence can delay state transitions;
the raw score, raw label, stable score, and risk are separate fields.
