const A4 = 440;
const NOTE_NAMES = ["C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4"];
const A4_INDEX = NOTE_NAMES.indexOf("A4");

const ATTACK_TIME = 0.05;
const RELEASE_TIME = 0.02;
const NOTE_GAIN = 0.25;

// Breath wobble: a slow, shallow detune LFO standing in for the pitch drift
// of real air pressure through a reed.
const VIBRATO_RATE = 2; // Hz
const VIBRATO_DEPTH = 6; // cents

// Breath noise: a short filtered noise burst layered under the attack to
// suggest the "chiff" of air hitting the reed, then it fades out on its own.
const BREATH_DURATION = 0.3; // seconds, also the shared noise buffer length
const BREATH_DECAY = 0.15; // seconds, fade-out after the attack peak
const BREATH_GAIN = NOTE_GAIN * 0.35;

export const WAVEFORMS = ["reed", "sine", "triangle", "sawtooth", "square"];

// Fourier sine-coefficients (index 0 = DC, index n = amplitude of the nth
// harmonic) approximating a free-reed spectrum: strong fundamental, prominent
// 2nd harmonic, and a handful of tapering upper partials for a buzzy, airy
// timbre closer to a real pitch pipe than a stock oscillator waveform.
const REED_HARMONICS = [0, 1.0, 0.55, 0.35, 0.25, 0.18, 0.12, 0.08, 0.05];

function frequencyFor(index) {
  return A4 * Math.pow(2, (index - A4_INDEX) / 12);
}

export const NOTE_FREQUENCIES = Object.fromEntries(
  NOTE_NAMES.map((name, i) => [name, frequencyFor(i)])
);

export class PitchPipe {
  constructor() {
    this._context = null;
    this._activeNotes = new Map();
    this._reedWave = null;
    this._noiseBuffer = null;
    this.waveform = "reed";
  }

  setWaveform(waveform) {
    if (!WAVEFORMS.includes(waveform)) return;
    this.waveform = waveform;
  }

  _getReedWave(context) {
    if (!this._reedWave) {
      const real = new Float32Array(REED_HARMONICS.length);
      const imag = new Float32Array(REED_HARMONICS);
      this._reedWave = context.createPeriodicWave(real, imag);
    }
    return this._reedWave;
  }

  _getNoiseBuffer(context) {
    if (!this._noiseBuffer) {
      const length = Math.ceil(context.sampleRate * BREATH_DURATION);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this._noiseBuffer = buffer;
    }
    return this._noiseBuffer;
  }

  _ensureContext() {
    if (!this._context) {
      this._context = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._context.state === "suspended") {
      this._context.resume();
    }
    return this._context;
  }

  noteOn(noteName) {
    const frequency = NOTE_FREQUENCIES[noteName];
    if (!frequency) return;

    const context = this._ensureContext();

    this._stopNote(noteName);

    const oscillator = context.createOscillator();
    if (this.waveform === "reed") {
      oscillator.setPeriodicWave(this._getReedWave(context));
    } else {
      oscillator.type = this.waveform;
    }
    oscillator.frequency.value = frequency;

    const gainNode = context.createGain();
    const now = context.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(NOTE_GAIN, now + ATTACK_TIME);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    // Pitch wobble: a slow LFO modulating detune (cents) rather than raw
    // frequency, so the depth feels consistent across the whole octave.
    const lfo = context.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = VIBRATO_RATE;
    const lfoGain = context.createGain();
    lfoGain.gain.value = VIBRATO_DEPTH;
    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.detune);
    lfo.start(now);

    // Breath noise: short filtered burst layered under the attack.
    const noiseSource = context.createBufferSource();
    noiseSource.buffer = this._getNoiseBuffer(context);
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = frequency * 2;
    noiseFilter.Q.value = 0.7;
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(BREATH_GAIN, now + ATTACK_TIME);
    noiseGain.gain.linearRampToValueAtTime(0, now + ATTACK_TIME + BREATH_DECAY);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(context.destination);
    noiseSource.start(now);
    noiseSource.stop(now + BREATH_DURATION);
    noiseSource.onended = () => {
      noiseSource.disconnect();
      noiseFilter.disconnect();
      noiseGain.disconnect();
    };

    oscillator.start(now);

    this._activeNotes.set(noteName, { oscillator, gainNode, lfo, lfoGain, noiseSource });
  }

  noteOff(noteName) {
    this._stopNote(noteName);
  }

  _stopNote(noteName) {
    const active = this._activeNotes.get(noteName);
    if (!active) return;
    this._activeNotes.delete(noteName);

    const { oscillator, gainNode, lfo, lfoGain, noiseSource } = active;
    const context = this._context;
    const now = context.currentTime;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + RELEASE_TIME);

    oscillator.stop(now + RELEASE_TIME);
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };

    lfo.stop(now + RELEASE_TIME);
    lfo.onended = () => {
      lfo.disconnect();
      lfoGain.disconnect();
    };

    // The breath-noise burst may have already finished and auto-stopped
    // itself (see BREATH_DURATION); stopping an already-stopped source throws.
    try {
      noiseSource.stop(now);
    } catch {
      // already stopped
    }
  }
}

export { NOTE_NAMES };
