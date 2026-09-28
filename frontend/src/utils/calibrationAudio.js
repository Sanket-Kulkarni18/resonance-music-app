let context;

function getContext() {
  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
  }
  if (context.state === 'suspended') context.resume();
  return context;
}

export function playCalibrationChirp(panPosition = 0) {
  try {
    const audioContext = getContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const panner = audioContext.createStereoPanner();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, now);
    oscillator.frequency.exponentialRampToValueAtTime(1760, now + 0.09);
    oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.22);

    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panPosition)), now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.13, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    oscillator.connect(panner);
    panner.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  } catch {
    // Browsers may prevent Web Audio before a direct user interaction.
  }
}
