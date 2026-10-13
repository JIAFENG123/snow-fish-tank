// Procedural ambient aquarium music using Web Audio API
// Generates warm underwater pads, shimmering water textures, and sparse melodic tones

const PENTA = [0, 2, 4, 7, 9]; // pentatonic degrees
const BASE_FREQ = 110; // A2 — deep anchor

function midiFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class AmbientMusic {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.playing = false;
    this._started = false;
    this._nodes = [];
    this._timers = [];
    this.volume = 0.45;
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // master gain
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    // convolver (simple impulse reverb)
    this.reverb = this._createReverb(2.8, 0.35);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.3;
    this.reverbGain.connect(this.reverb);
    this.reverb.connect(this.master);

    // dry bus
    this.dry = this.ctx.createGain();
    this.dry.gain.value = 0.7;
    this.dry.connect(this.master);
  }

  _createReverb(duration, decay) {
    const rate = this.ctx.sampleRate;
    const len = rate * duration;
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay * 5);
      }
    }
    const conv = this.ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  _connect(node) {
    node.connect(this.dry);
    node.connect(this.reverbGain);
    this._nodes.push(node);
  }

  // --- pad layer: warm evolving chord ---
  _startPad() {
    const ctx = this.ctx;
    // three voices forming a minor chord, slowly drifting
    const notes = [
      midiFreq(45), // A2
      midiFreq(52), // E3
      midiFreq(57), // A3
      midiFreq(60), // C4
    ];

    for (const freq of notes) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // gentle detune LFO
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.05 + Math.random() * 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 2.5;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      lfo.start();
      this._nodes.push(lfo);

      const gain = ctx.createGain();
      gain.gain.value = 0.04;

      // slow volume breathing
      const breathLfo = ctx.createOscillator();
      breathLfo.type = 'sine';
      breathLfo.frequency.value = 0.08 + Math.random() * 0.05;
      const breathGain = ctx.createGain();
      breathGain.gain.value = 0.015;
      breathLfo.connect(breathGain);
      breathGain.connect(gain.gain);
      breathLfo.start();
      this._nodes.push(breathLfo);

      osc.connect(gain);
      this._connect(gain);
      osc.start();
      this._nodes.push(osc);
    }
  }

  // --- water shimmer: filtered noise ---
  _startWater() {
    const ctx = this.ctx;
    const bufSize = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 0.8;

    // modulate filter frequency
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 1200;
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);
    lfo.start();
    this._nodes.push(lfo);

    const gain = ctx.createGain();
    gain.gain.value = 0.018;

    noise.connect(bp);
    bp.connect(gain);
    this._connect(gain);
    noise.start();
    this._nodes.push(noise);
  }

  // --- deep sub drone ---
  _startSub() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55; // A1

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.03;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();
    this._nodes.push(lfo);

    const gain = ctx.createGain();
    gain.gain.value = 0.06;

    osc.connect(gain);
    this._connect(gain);
    osc.start();
    this._nodes.push(osc);
  }

  // --- sparse melodic chimes ---
  _scheduleChime() {
    if (!this.playing) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // pick a random pentatonic note in the4th-6th octave
    const deg = PENTA[Math.floor(Math.random() * PENTA.length)];
    const octave = 4 + Math.floor(Math.random() * 3);
    const midi = octave * 12 + deg;
    const freq = midiFreq(midi);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.035 + Math.random() * 0.02, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5 + Math.random() * 2);

    osc.connect(gain);
    this._connect(gain);
    osc.start(now);
    osc.stop(now + 5);

    // next chime in3-8 seconds
    const next = 3000 + Math.random() * 5000;
    const timer = setTimeout(() => this._scheduleChime(), next);
    this._timers.push(timer);
  }

  // --- bubble pop tones ---
  _scheduleBubble() {
    if (!this.playing) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const freq = 800 + Math.random() * 2400;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.012, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(gain);
    this._connect(gain);
    osc.start(now);
    osc.stop(now + 0.25);

    const next = 1500 + Math.random() * 4000;
    const timer = setTimeout(() => this._scheduleBubble(), next);
    this._timers.push(timer);
  }

  async play() {
    await this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.playing = true;

    if (!this._started) {
      this._started = true;
      this._startPad();
      this._startWater();
      this._startSub();
      this._scheduleChime();
      this._scheduleBubble();
    }

    // fade in
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 1.5);
  }

  pause() {
    if (!this.ctx || !this.playing) return;
    this.playing = false;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.0);
  }

  toggle() {
    if (this.playing) this.pause(); else this.play();
    return this.playing;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.playing && this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setValueAtTime(this.master.gain.value, this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.3);
    }
  }
}

export const music = new AmbientMusic();
