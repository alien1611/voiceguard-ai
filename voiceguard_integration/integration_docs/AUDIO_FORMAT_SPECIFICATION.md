# Audio format specification

## File input

File format is identified from the file header, not its extension. Supported
container/codec paths are WAV, MP3, FLAC, OGG, and AIFF when the installed
SoundFile/libsndfile build includes the relevant decoder. A mismatched extension
does not select a decoder. Decode failures raise `AudioDecodeError`; unknown or
unsupported content raises `AudioFormatError`.

Raw PCM files must use `.pcm` or `.raw` and pass all of
`raw_sample_rate`, `raw_channels`, and `raw_encoding` to `predict_file`.
Encodings include `int16`/`s16le`, `int32`/`s32le`, `uint8`, and
`float32`/`f32le`. Raw PCM is decoded as samples directly; it is never passed to
an MP3 decoder.

## Audio arrays and microphone

External arrays have shape `(frames,)` or `(frames, channels)` and may be
floating point or integer. Stereo/multichannel data is averaged to mono.
Microphone capture is mono float32 at the selected device's default rate. It
uses an optional `sounddevice` adapter; the main file and chunk APIs have no
microphone-library dependency.

## Preprocessing contract

- Mono conversion precedes resampling.
- Resampling uses polyphase resampling to 16,000 Hz.
- Exactly 64,000 samples enter the LFCC extractor.
- Short input is zero-padded at the end; long input is cropped from the start.
- Input is not looped or repeated to fill the four-second model window.
- Quality warnings flag near-silence, very low RMS, and possible clipping. These
  are heuristics, not proof of spoofing or causes of a misclassification.

For continuous streams, each model window is assembled at the original session
sample rate and then processed using the same offline preprocessing. At the
default four-second window and one-second updates, each later window contains
the preceding three seconds plus the next second.
