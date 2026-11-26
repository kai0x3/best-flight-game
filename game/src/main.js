// main.js — Ridgeline Courier: game state, loop, input, missions and screens.
// A bush-plane courier flying three sorties down an alpine valley.
// Original code written for this game.

import { clamp, deg2rad, rad2deg } from './noise.js';
import {
  heightAt, STRIPS, CABINS, makeTrees, makeClouds,
} from './terrain.js';
import { newPlane, stepFlight, knots, feet } from './flight.js';
import {
  makeCamera, updateCamera, aimCamera, project, drawSky, drawTerrain,
  drawRunway, drawRing, drawTrees, drawCabins, drawClouds, drawPlane,
} from './render.js';
import { drawHUD } from './hud.js';
import { MISSIONS, SKIES, missionRating } from './missions.js';
import { makeAudio } from './audio.js';
import { parseShot, applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');

const G = {
  canvas, ctx,
  W: 1280, H: 720,
  mode: 'title',           // title | briefing | fly | paused | complete | crashed | gameover
  time: 0,
  missionIndex: 0,
  mission: MISSIONS[0],
  plane: null,
  cam: makeCamera(),
  trees: makeTrees(),
  clouds: makeClouds(),
  cabins: CABINS,
  score: 0,
  totalScore: 0,
  missionTime: 0,
  events: { agl: 0 },
  audio: makeAudio(),
  input: {
    keys: new Set(),
    steerX: 0, steerY: 0, dragging: false,
  },
  frozen: false,
  shotMode: false,
  result: null,
  crashReason: '',
  crashTimer: 0,
};

window.__game = G;

function sky() { return SKIES[G.mission.sky]; }

// ---------- Mission flow ----------

function startMission(i) {
  G.missionIndex = i;
  G.mission = MISSIONS[i];
  for (const r of G.mission.rings) { r.passed = false; r.best = 0; }
  const s = G.mission.start;
  G.plane = newPlane(s.x, s.z, s.heading);
  G.plane.throttle = 0;
  G.score = 0;
  G.missionTime = 0;
  G.events = { agl: 0 };
  G.result = null;
  G.cam.x = G.plane.x - Math.sin(G.plane.heading) * 30;
  G.cam.y = G.plane.y + 8;
  G.cam.z = G.plane.z - Math.cos(G.plane.heading) * 30;
  G.mode = 'fly';
  overlay.classList.add('hidden');
  updatePauseButton();
}

function showBriefing(i) {
  const m = MISSIONS[i];
  G.mode = 'briefing';
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="card">
      <div class="kicker">RIDGELINE COURIER — SORTIE ${m.id} OF 3</div>
      <h1>${m.name}</h1>
      <p class="brief">${m.briefing}</p>
      <div class="facts">
        <div><span>Rings</span><b>${m.rings.length}</b></div>
        <div><span>Land at</span><b>${STRIPS[m.targetStrip].name}</b></div>
        <div><span>Par time</span><b>${Math.floor(m.par / 60)}:${String(m.par % 60).padStart(2, '0')}</b></div>
        <div><span>Gold</span><b>${m.goldScore} pts</b></div>
      </div>
      <div class="controls">
        <div><b>W / S</b> throttle</div>
        <div><b>↑ / ↓</b> pitch</div>
        <div><b>← / →</b> bank &amp; turn</div>
        <div><b>Drag</b> steer with mouse</div>
        <div><b>P</b> pause &nbsp; <b>R</b> restart &nbsp; <b>M</b> sound</div>
      </div>
      <button class="primary" data-action="fly">Take off — Sortie ${m.id}</button>
      <button class="ghost" data-action="title">Back to menu</button>
    </div>`;
}

function showTitle() {
  G.mode = 'title';
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="card wide">
      <div class="kicker">AN ORIGINAL BUSH-PLANE FLIGHT GAME</div>
      <h1>Ridgeline Courier</h1>
      <p class="brief">Fly the mail plane down Ridgeline Valley. Thread the marker rings,
      watch your fuel, mind the ridges — and bring her home on the grass strip
      in one piece. Three sorties, one valley, no autopilot.</p>
      <div class="missions">
        ${MISSIONS.map((m, i) => `
          <button class="mission" data-action="briefing" data-i="${i}">
            <b>${m.id}. ${m.name}</b>
            <span>${m.rings.length} rings · ${SKIES[m.sky].name} · land at ${STRIPS[m.targetStrip].name}</span>
          </button>`).join('')}
      </div>
      <button class="primary" data-action="briefing" data-i="0">Start Sortie 1 — Valley Run</button>
      <p class="fine">Keyboard + mouse · works offline · sound: M to mute</p>
    </div>`;
}

function completeMission() {
  const p = G.plane;
  const m = G.mission;
  const ringsGot = m.rings.filter((r) => r.passed).length;
  const timeBonus = Math.max(0, Math.round((m.par - G.missionTime) * 2));
  const landingBonus = 500;
  const damageCost = Math.round(p.damage * 3);
  const total = G.score + timeBonus + landingBonus - damageCost;
  G.score = total;
  G.totalScore += total;
  const rating = missionRating(m, total);
  G.result = {
    rating, rings: ringsGot, ringsTotal: m.rings.length,
    time: Math.round(G.missionTime), timeBonus, landingBonus,
    damage: Math.round(p.damage), fuelLeft: Math.round(p.fuel),
  };
  G.audio.thud();
  if (G.missionIndex >= 2) {
    G.mode = 'gameover';
  } else {
    G.mode = 'complete';
  }
  showEndScreen();
}

function showEndScreen() {
  const r = G.result;
  const m = G.mission;
  const mm = Math.floor(r.time / 60), ss = String(r.time % 60).padStart(2, '0');
  const isFinal = G.mode === 'gameover';
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="card">
      <div class="kicker">${isFinal ? 'TOUR COMPLETE' : 'SORTIE COMPLETE'}</div>
      <h1>${isFinal ? 'Valley Conquered' : m.name + ' — Landed!'}</h1>
      <div class="rating ${r.rating.toLowerCase()}">${r.rating} RATING</div>
      <div class="facts">
        <div><span>Rings</span><b>${r.rings} / ${r.ringsTotal}</b></div>
        <div><span>Time</span><b>${mm}:${ss}</b></div>
        <div><span>Time bonus</span><b>+${r.timeBonus}</b></div>
        <div><span>Landing</span><b>+${r.landingBonus}</b></div>
        <div><span>Hull</span><b>${100 - r.damage}%</b></div>
        <div><span>Fuel left</span><b>${r.fuelLeft}%</b></div>
      </div>
      <p class="score-line">Sortie score <b>${G.score}</b>${isFinal ? ` &nbsp;·&nbsp; Tour total <b>${G.totalScore}</b>` : ''}</p>
      ${isFinal
        ? `<button class="primary" data-action="title">Fly again from Sortie 1</button>`
        : `<button class="primary" data-action="briefing" data-i="${G.missionIndex + 1}">Next sortie — ${MISSIONS[G.missionIndex + 1].name}</button>
           <button class="ghost" data-action="briefing" data-i="${G.missionIndex}">Replay this sortie</button>`}
    </div>`;
}

function crashMission(reason) {
  const p = G.plane;
  G.crashReason = reason;
  G.audio.crash();
  G.mode = 'crashed';
  overlay.classList.remove('hidden');
  const title = reason === 'fuel' ? 'Out of Fuel' : reason === 'damage' ? 'Airframe Gave Out' : 'Crashed';
  const tip = reason === 'fuel'
    ? 'The tank ran dry. Rings top the tank up — fly through them, and keep the throttle out of the red on the long legs.'
    : 'The valley is not forgiving. Come in slow, wings level, and flare — don’t dive at the ground.';
  overlay.innerHTML = `
    <div class="card">
      <div class="kicker">SORTIE ${G.mission.id} — ${G.mission.name.toUpperCase()}</div>
      <h1>${title}</h1>
      <p class="brief">${tip}</p>
      <div class="facts">
        <div><span>Rings cleared</span><b>${G.mission.rings.filter((r) => r.passed).length} / ${G.mission.rings.length}</b></div>
        <div><span>Score</span><b>${G.score}</b></div>
        <div><span>Altitude</span><b>${Math.round(feet(Math.max(0, p.y)))} ft</b></div>
      </div>
      <button class="primary" data-action="retry">Try again</button>
      <button class="ghost" data-action="title">Back to menu</button>
    </div>`;
}

// ---------- Input ----------

const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']);

window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.has(e.key)) e.preventDefault();
  G.audio.init();
  if (e.repeat) return;
  G.input.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
  if (e.key === 'r' || e.key === 'R') {
    if (G.mode === 'fly' || G.mode === 'paused' || G.mode === 'crashed') startMission(G.missionIndex);
  }
  if (e.key === 'm' || e.key === 'M') {
    G.audio.setMuted(!G.audio.muted);
    updateMuteButton();
  }
  if (e.key === 'Enter') {
    const btn = overlay.querySelector('.primary');
    if (btn && !overlay.classList.contains('hidden')) btn.click();
  }
});
window.addEventListener('keyup', (e) => {
  G.input.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
});

let dragStart = null;
canvas.addEventListener('pointerdown', (e) => {
  G.audio.init();
  dragStart = { x: e.clientX, y: e.clientY };
  G.input.dragging = true;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragStart) return;
  G.input.steerX = clamp((e.clientX - dragStart.x) / 140, -1, 1);
  G.input.steerY = clamp((e.clientY - dragStart.y) / 140, -1, 1);
});
function endDrag() {
  dragStart = null;
  G.input.dragging = false;
  G.input.steerX = 0;
  G.input.steerY = 0;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

overlay.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  G.audio.init();
  G.audio.click();
  const action = btn.dataset.action;
  const i = Number(btn.dataset.i || 0);
  if (action === 'briefing') showBriefing(i);
  else if (action === 'fly') startMission(i);
  else if (action === 'title') { G.totalScore = 0; showTitle(); }
  else if (action === 'retry') startMission(G.missionIndex);
});

document.getElementById('pauseBtn').addEventListener('click', () => { G.audio.init(); togglePause(); });
document.getElementById('muteBtn').addEventListener('click', () => {
  G.audio.init();
  G.audio.setMuted(!G.audio.muted);
  updateMuteButton();
});

function updateMuteButton() {
  document.getElementById('muteBtn').textContent = G.audio.muted ? '🔇 Sound off' : '🔊 Sound on';
}
function updatePauseButton() {
  document.getElementById('pauseBtn').textContent = G.mode === 'paused' ? '▶ Resume' : '⏸ Pause';
}
function togglePause() {
  if (G.mode === 'fly') {
    G.mode = 'paused';
    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <div class="card">
        <div class="kicker">PAUSED</div>
        <h1>Holding Pattern</h1>
        <p class="brief">The valley waits. Take a breath, check the gauges, then get back in the air.</p>
        <button class="primary" data-action="resume">Back to flying</button>
        <button class="ghost" data-action="retry">Restart sortie</button>
      </div>`;
    overlay.querySelector('[data-action="resume"]').addEventListener('click', () => {
      G.mode = 'fly';
      overlay.classList.add('hidden');
      updatePauseButton();
    });
  } else if (G.mode === 'paused') {
    G.mode = 'fly';
    overlay.classList.add('hidden');
  }
  updatePauseButton();
}

// ---------- Simulation ----------

function readInput() {
  const k = G.input.keys;
  return {
    throttleUp: k.has('w') || k.has('W'),
    throttleDown: k.has('s') || k.has('S'),
    pitchUp: k.has('ArrowUp'),
    pitchDown: k.has('ArrowDown'),
    rollLeft: k.has('ArrowLeft') || k.has('a') || k.has('A'),
    rollRight: k.has('ArrowRight') || k.has('d') || k.has('D'),
    steerX: G.input.steerX,
    steerY: G.input.steerY,
  };
}

function checkRings() {
  const p = G.plane;
  const m = G.mission;
  for (const r of m.rings) {
    if (r.passed) continue;
    const dx = p.x - r.x, dy = p.y - r.y, dz = p.z - r.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < r.r) {
      r.passed = true;
      const center = d < r.r * 0.45;
      G.score += center ? 150 : 100;
      p.fuel = Math.min(100, p.fuel + 6);
      G.audio.ring(center);
    }
  }
}

function overStrip(p, strip) {
  return Math.abs(p.x - strip.x) < strip.width / 2 + 6
    && Math.abs(p.z - strip.z) < strip.length / 2 + 10;
}

function step(dt) {
  const p = G.plane;
  if (!p) return;
  const events = {};
  stepFlight(p, readInput(), dt, events);
  // Crosswind pushes the plane sideways while airborne.
  const wind = G.mission.wind || 0;
  if (!p.onGround && wind !== 0) p.x += wind * dt * 0.9;
  events.agl = p.y - heightAt(p.x, p.z);
  G.events = events;

  if (events.touchdown) G.audio.thud();
  if (events.takeoff) G.audio.click();
  if (events.stalled && Math.random() < dt * 2) G.audio.warn();
  if (events.crash) { crashMission('terrain'); return; }
  if (p.damage >= 100) { p.crashed = true; crashMission('damage'); return; }
  if (events.fuelEmpty && p.onGround && p.speed < 2) { crashMission('fuel'); return; }

  checkRings();

  // Landing: on the target strip, rolling slow, in one piece.
  const target = STRIPS[G.mission.targetStrip];
  if (p.onGround && !p.crashed && overStrip(p, target) && p.speed < 28 && Math.abs(p.roll) < deg2rad(15)) {
    p.landed = true;
    completeMission();
    return;
  }
  G.missionTime += dt;
}

// ---------- Render ----------

function render() {
  const { W, H } = G;
  const s = sky();
  drawSky(ctx, W, H, s, G.plane ? G.plane.heading : 0, G.time);
  if (G.plane) {
    if (G.camOverride) {
      const o = G.camOverride;
      aimCamera(G.cam, o.eye[0], o.eye[1], o.eye[2], o.target[0], o.target[1], o.target[2], 0);
      G.cam.focal = H * 1.05;
    } else {
      updateCamera(G.cam, G.plane, 1 / 60, W, H);
    }
    drawTerrain(ctx, G.cam, W, H, s, G.trees, G.time);
    for (const strip of STRIPS) drawRunway(ctx, G.cam, W, H, s, strip);
    const next = G.mission.rings.find((r) => !r.passed);
    for (const r of G.mission.rings) drawRing(ctx, G.cam, W, H, r, G.time, r === next);
    drawCabins(ctx, G.cam, W, H, G.cabins);
    drawTrees(ctx, G.cam, W, H, G.trees, s);
    drawClouds(ctx, G.cam, W, H, G.clouds, G.time, s);
    if (G.mode !== 'title' && G.mode !== 'briefing') drawPlane(ctx, W, H, G.plane, G.time);
    if (G.mode === 'fly' || G.mode === 'paused') drawHUD(ctx, W, H, G);
  }
}

// ---------- Loop ----------

let last = performance.now();
let shotReadyFlagged = false;
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  G.time += dt;
  if (G.mode === 'fly' && !G.frozen) {
    step(dt);
    G.audio.update(G.plane, dt);
  }
  render();
  if (G.shotMode && !shotReadyFlagged) {
    shotReadyFlagged = true;
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

// ---------- Resize ----------

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  G.W = w; G.H = h;
}
window.addEventListener('resize', resize);
resize();

// ---------- Boot ----------

// A parked plane behind the title screen so the menu sits over the valley.
G.plane = newPlane(0, -60, 0);
G.plane.y = heightAt(0, -60) + 2.2;
G.mode = 'title';

const shot = parseShot();
if (shot) {
  const applied = applyShot(G, shot);
  if (applied) {
    overlay.classList.add('hidden');
    if (G.mode === 'complete') showEndScreen();
    updatePauseButton();
  } else {
    showTitle();
  }
} else {
  showTitle();
}

requestAnimationFrame(frame);
