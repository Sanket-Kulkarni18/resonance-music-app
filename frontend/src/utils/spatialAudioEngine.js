// Lightweight Web Audio API spatial synth & calibration chirp generator
class SpatialAudioEngine {
    ctx = null;
    isPlaying = false;
    panner = null;
    masterGain = null;
    oscillators = [];
    ensureContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }
    playCalibrationChirp(panPosition = 0) {
        try {
            const ctx = this.ensureContext();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const panner = ctx.createStereoPanner();
            panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panPosition)), now);
            // Studio acoustic radar chirp (880Hz -> 1760Hz -> 440Hz pulse)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(660, now);
            osc.frequency.exponentialRampToValueAtTime(1760, now + 0.09);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
            osc.connect(panner);
            panner.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.3);
        }
        catch {
            // Ignore if browser blocks audio before interaction
        }
    }
    startSpatialDrone(frequencies, volumePct = 70) {
        try {
            this.stopSpatialDrone();
            const ctx = this.ensureContext();
            const now = ctx.currentTime;
            const masterGain = ctx.createGain();
            const panner = ctx.createStereoPanner();
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(950, now);
            const targetGain = Math.max(0.01, (volumePct / 100) * 0.12);
            masterGain.gain.setValueAtTime(0.001, now);
            masterGain.gain.exponentialRampToValueAtTime(targetGain, now + 0.4);
            filter.connect(panner);
            panner.connect(masterGain);
            masterGain.connect(ctx.destination);
            const oscs = [];
            frequencies.forEach((freqStr, idx) => {
                const osc = ctx.createOscillator();
                const oscGain = ctx.createGain();
                osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
                osc.frequency.setValueAtTime(parseFloat(freqStr) || 220, now);
                oscGain.gain.setValueAtTime(idx === 0 ? 0.45 : 0.22, now);
                osc.connect(oscGain);
                oscGain.connect(filter);
                osc.start(now);
                oscs.push(osc);
            });
            this.oscillators = oscs;
            this.panner = panner;
            this.masterGain = masterGain;
            this.isPlaying = true;
        }
        catch {
            // Ignore audio errors
        }
    }
    updatePanAndVolume(panValue, volumePct) {
        if (!this.ctx || !this.isPlaying)
            return;
        const now = this.ctx.currentTime;
        if (this.panner) {
            this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, panValue)), now, 0.05);
        }
        if (this.masterGain) {
            const targetGain = Math.max(0.001, (volumePct / 100) * 0.12);
            this.masterGain.gain.setTargetAtTime(targetGain, now, 0.08);
        }
    }
    stopSpatialDrone() {
        try {
            this.oscillators.forEach((osc) => {
                try {
                    osc.stop();
                    osc.disconnect();
                }
                catch {
                    // ignore
                }
            });
        }
        catch {
            // ignore
        }
        this.oscillators = [];
        this.isPlaying = false;
    }
}
export const spatialAudio = new SpatialAudioEngine();
