// audio.js — all sound in Ridgeline Courier is synthesised live with WebAudio:
// a propeller engine, wind, ring chimes and landing thuds. No audio files.

export function makeAudio() {
  const A = {
    ctx: null, master: null, engineOsc: null, engineOsc2: null,
    engineGain: null, windSrc: null, windGain: null, windFilter: null,
    muted: false, started: false,
  };

  A.init = function () {
    if (A.started) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain();
      A.master.gain.value = A.muted ? 0 : 0.5;
      A.master.connect(A.ctx.destination);

      // Engine: two detuned saws through a low-pass, pitch follows throttle.
      A.engineOsc = A.ctx.createOscillator();
      A.engineOsc.type = 'sawtooth';
      A.engineOsc.frequency.value = 55;
      A.engineOsc2 = A.ctx.createOscillator();
      A.engineOsc2.type = 'sawtooth';
      A.engineOsc2.frequency.value = 55.7;
      const lp = A.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 1.2;
      A.engineGain = A.ctx.createGain();
      A.engineGain.gain.value = 0;
      A.engineOsc.connect(lp); A.engineOsc2.connect(lp);
      lp.connect(A.engineGain); A.engineGain.connect(A.master);
      A.engineOsc.start(); A.engineOsc2.start();

      // Wind: looped noise buffer through a band-pass.
      const len = A.ctx.sampleRate * 2;
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      A.windSrc = A.ctx.createBufferSource();
      A.windSrc.buffer = buf; A.windSrc.loop = true;
      A.windFilter = A.ctx.createBiquadFilter();
      A.windFilter.type = 'bandpass'; A.windFilter.frequency.value = 500; A.windFilter.Q.value = 0.6;
      A.windGain = A.ctx.createGain();
      A.windGain.gain.value = 0;
      A.windSrc.connect(A.windFilter); A.windFilter.connect(A.windGain);
      A.windGain.connect(A.master);
      A.windSrc.start();
      A.started = true;
    } catch (e) {
      // Audio is decoration; the game plays fine without it.
      A.started = false;
    }
  };

  A.update = function (plane, dt) {
    if (!A.started || !A.ctx) return;
    const t = A.ctx.currentTime;
    const rpm = 50 + plane.throttle * 95 + plane.speed * 0.35;
    A.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    A.engineOsc2.frequency.setTargetAtTime(rpm * 1.008 + 1.5, t, 0.08);
    const eng = plane.onGround && plane.speed < 2 ? 0.05 : 0.05 + plane.throttle * 0.11;
    A.engineGain.gain.setTargetAtTime(eng, t, 0.1);
    const wind = Math.min(0.16, plane.speed * 0.0016);
    A.windGain.gain.setTargetAtTime(wind, t, 0.15);
    A.windFilter.frequency.setTargetAtTime(320 + plane.speed * 9, t, 0.15);
  };

  function tone(freq, dur, type, vol, when = 0) {
    if (!A.started || !A.ctx) return;
    const t = A.ctx.currentTime + when;
    const o = A.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  A.ring = function (center) {
    tone(880, 0.5, 'sine', 0.22);
    tone(1318, 0.6, 'sine', 0.18, 0.07);
    if (center) tone(1760, 0.7, 'sine', 0.15, 0.14);
  };
  A.thud = function () {
    if (!A.started || !A.ctx) return;
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + 0.35);
  };
  A.crash = function () {
    if (!A.started || !A.ctx) return;
    const t = A.ctx.currentTime;
    const len = A.ctx.sampleRate * 0.5;
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource();
    src.buffer = buf;
    const lp = A.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = A.ctx.createGain(); g.gain.value = 0.6;
    src.connect(lp); lp.connect(g); g.connect(A.master);
    src.start(t);
  };
  A.click = function () { tone(660, 0.08, 'square', 0.08); };
  A.warn = function () { tone(440, 0.18, 'square', 0.12); tone(440, 0.18, 'square', 0.12, 0.22); };

  A.setMuted = function (m) {
    A.muted = m;
    if (A.master && A.ctx) A.master.gain.setTargetAtTime(m ? 0 : 0.5, A.ctx.currentTime, 0.05);
  };

  return A;
}
