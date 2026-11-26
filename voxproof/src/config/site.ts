/**
 * VOXPROOF Site & Brand Configuration
 * ====================================
 * Single source of truth for branding, product name, and policy statements.
 */

export const BRAND_NAME = "VOXPROOF" as const;

export const siteConfig = {
  name: BRAND_NAME,
  description: "Forensic voice-authenticity detector powered by LFCC feature extraction and deep convolutional networks.",
  tagline: "Forensic voice-authenticity intelligence.",
  
  // Single config constant for retention and privacy statements
  // TODO: Confirm the real organizational data retention policy with legal and infrastructure teams before production launch.
  retentionPolicy: "Transient memory-only processing. Raw waveforms are discarded immediately after feature extraction. Zero audio audio bytes are persisted to disk or cloud egress.",

  version: "1.4.0-preview",
  modelArchitecture: "AudioCNN-60LFCC",
  
  navLinks: [
    { label: "Analyze", href: "/analyze" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Model", href: "/#model-transparency" },
    { label: "API", href: "/#api-access" },
  ],

  appNavLinks: [
    { label: "Analyze", href: "/analyze", icon: "Mic" },
    { label: "History", href: "/history", icon: "Clock" },
    { label: "Batch", href: "/batch", icon: "Layers" },
    { label: "Reports", href: "/history", icon: "FileText" },
    { label: "API Keys", href: "/#api-access", icon: "Key" },
    { label: "Settings", href: "/analyze", icon: "Settings" },
  ],

  attackFamilies: [
    "TEXT-TO-SPEECH (TTS)",
    "VOICE CONVERSION (VC)",
    "NEURAL VOCODERS",
    "REPLAY ATTACKS",
    "CLONED VOICES",
    "DEEPFAKE AUDIO",
    "SYNTHETIC PROSODY",
  ],
};
