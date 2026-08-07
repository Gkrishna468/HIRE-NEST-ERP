// src/lib/services/speechService.ts

/**
 * Robust Speech & Audible Briefing Service
 * Supports Chrome chunking, voice loading, resume fixes, and Web Audio synth backup.
 */

let activeUtterances: SpeechSynthesisUtterance[] = [];
let isSpeakingState = false;

function playWebAudioTone() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn("[SpeechService] WebAudio tone notice:", e);
  }
}

export function stopBriefingSpeech() {
  isSpeakingState = false;
  activeUtterances = [];
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function isBriefingSpeaking(): boolean {
  return isSpeakingState;
}

export function speakBriefing(
  rawText: string,
  onEnd?: () => void,
  onError?: (err?: any) => void
) {
  stopBriefingSpeech();

  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    playWebAudioTone();
    if (onEnd) onEnd();
    return;
  }

  // Play subtle audible start cue via Web Audio
  playWebAudioTone();

  // Clean raw text
  const cleanText = rawText
    .replace(/[-=]{3,}/g, " ")
    .replace(/•/g, " ")
    .replace(/\*+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  // Split text into smaller sentence chunks to bypass Chrome's 15s synthesis cutoff bug
  const chunks = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice =
    voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Natural") ||
          v.name.includes("Google") ||
          v.name.includes("Samantha") ||
          v.name.includes("Karen") ||
          v.name.includes("Daniel"))
    ) || voices.find((v) => v.lang.startsWith("en"));

  isSpeakingState = true;
  let currentChunkIndex = 0;

  const speakNextChunk = () => {
    if (!isSpeakingState || currentChunkIndex >= chunks.length) {
      isSpeakingState = false;
      if (onEnd) onEnd();
      return;
    }

    const chunkText = chunks[currentChunkIndex].trim();
    if (!chunkText) {
      currentChunkIndex++;
      speakNextChunk();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunkText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      currentChunkIndex++;
      speakNextChunk();
    };

    utterance.onerror = (e) => {
      console.warn("[SpeechService] Utterance notice:", e);
      currentChunkIndex++;
      speakNextChunk();
    };

    activeUtterances.push(utterance);

    // Unpause Chrome if stuck
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    window.speechSynthesis.speak(utterance);
  };

  // Ensure speech synthesis is resumed before speaking
  window.speechSynthesis.cancel();
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }

  speakNextChunk();
}
