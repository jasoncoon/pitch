const A4 = 440;
const NOTE_NAMES = ["C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4", "C5", "C#5", "D5", "D#5"];
const NOTE_TEXT = ["C<br />Middle", "C#<br />D♭", "D", "D#<br />E♭", "E", "F", "F#<br />G♭", "G", "G#<br />A♭", "A", "A#<br />B♭", "B", "C", "C#<br />D♭", "D", "D#<br />E♭", "E"];
const A4_INDEX = NOTE_NAMES.indexOf("A4");

const ATTACK_TIME = 1;
const DECAY_TIME = 0.4; // fade-out length after release, so notes don't cut off abruptly
const NOTE_GAIN = 0.25;

// Breath wobble: a slow, shallow detune LFO standing in for the pitch drift
// of real air pressure through a reed. Measured via sliding-window pitch
// tracking of the reference recording -- a real reed's pitch is set by its
// physical mass/stiffness, not an embouchure, so it barely wobbles at all
// (~1.5 cents RMS, no strong periodic component) compared to a
// breath-controlled wind instrument's vibrato.
const VIBRATO_RATE = 2; // Hz
const VIBRATO_DEPTH = 1.5; // cents

export const WAVEFORMS = ["reed", "sine", "triangle", "sawtooth", "square"];

// Fourier sine-coefficients (index 0 = DC, index n = amplitude of the nth
// harmonic), measured via Goertzel analysis of a real pitch pipe recording
// (C5, sustained note) rather than guessed: a weak 2nd harmonic and a
// dominant 3rd harmonic, unlike a stock oscillator waveform. Extended out to
// the 16th harmonic (rather than stopping at 8) because the recording still
// had meaningful energy that far up -- truncating it made the synthesized
// tone sound duller/thinner than the real recording.
const REED_HARMONICS = [
  0, 1.0, 0.092, 0.376, 0.11, 0.144, 0.052, 0.082, 0.12, 0.136, 0.107, 0.08,
  0.036, 0.01, 0.038, 0.1, 0.027,
];

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

    oscillator.start(now);

    this._activeNotes.set(noteName, { oscillator, gainNode, lfo, lfoGain });
  }

  noteOff(noteName) {
    this._stopNote(noteName);
  }

  _stopNote(noteName) {
    const active = this._activeNotes.get(noteName);
    if (!active) return;
    this._activeNotes.delete(noteName);

    const { oscillator, gainNode, lfo, lfoGain } = active;
    const context = this._context;
    const now = context.currentTime;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + DECAY_TIME);

    oscillator.stop(now + DECAY_TIME);
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };

    lfo.stop(now + DECAY_TIME);
    lfo.onended = () => {
      lfo.disconnect();
      lfoGain.disconnect();
    };
  }
}

export { NOTE_NAMES, NOTE_TEXT };
