let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** Call after user gesture so browsers allow playback */
export function primeAlertSound() {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    void ctx.resume();
  }
}

/** Short two-tone pop for incoming emergency alert */
export function playAlertPop() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;

    const beep = (start: number, freq: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.45, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };

    beep(now, 880, 0.18);
    beep(now + 0.2, 1175, 0.22);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([120, 60, 120]);
    }
  } catch {
    // Audio blocked or unavailable
  }
}
