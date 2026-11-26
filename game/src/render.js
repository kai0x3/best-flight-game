// render.js — the picture of Ridgeline Courier: a software 3D chase view over a
// procedural alpine valley, with the courier plane drawn in the foreground and a
// lit instrument panel around it. Original code written for this game.

import { clamp, lerp, fbm, smoothstep, deg2rad } from './noise.js';
import {
  heightAt, riverX, STRIPS, groundColor, fogMix, rgb, rgba,
} from './terrain.js';
import { SKIES } from './missions.js';

// ---- Camera ----
export function makeCamera() {
  return {
    x: 0, y: 60, z: -30,
    fx: 0, fy: 0, fz: 1,   // forward
    rx: 1, ry: 0, rz: 0,   // right
    ux: 0, uy: 1, uz: 0,   // up
    focal: 800,
  };
}

// Chase camera: sits behind and above the plane, rolls with it a little,
// and smooths so it never fights the pilot.
export function updateCamera(cam, plane, dt, W, H) {
  const fx = Math.sin(plane.heading), fz = Math.cos(plane.heading);
  const tx = plane.x - fx * 30 + Math.sin(plane.roll) * 4;
  const ty = plane.y + 8 - Math.sin(plane.pitch) * 10;
  const tz = plane.z - fz * 30;
  const k = Math.min(1, 5.5 * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.z += (tz - cam.z) * k;

  // Look at a point ahead of the plane.
  const lx = plane.x + fx * 70, ly = plane.y + 2, lz = plane.z + fz * 70;
  aimCamera(cam, cam.x, cam.y, cam.z, lx, ly, lz, plane.roll * 0.55);
  cam.focal = H * 1.05;
}

// Aim the camera from an eye point at a target, with a roll about the view axis.
export function aimCamera(cam, ex, ey, ez, tx, ty, tz, roll) {
  let fvx = tx - ex, fvy = ty - ey, fvz = tz - ez;
  const fl = Math.hypot(fvx, fvy, fvz) || 1;
  fvx /= fl; fvy /= fl; fvz /= fl;
  // Right = normalize(cross(forward, worldUp)) then rolled.
  let rx = -fvz, ry = 0, rz = fvx;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  // Up = cross(right, forward).
  let ux = ry * fvz - rz * fvy, uy = rz * fvx - rx * fvz, uz = rx * fvy - ry * fvx;
  // Apply roll around the forward axis.
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const r2x = rx * cr + ux * sr, r2y = ry * cr + uy * sr, r2z = rz * cr + uz * sr;
  const u2x = ux * cr - rx * sr, u2y = uy * cr - ry * sr, u2z = uz * cr - rz * sr;
  cam.x = ex; cam.y = ey; cam.z = ez;
  cam.fx = fvx; cam.fy = fvy; cam.fz = fvz;
  cam.rx = r2x; cam.ry = r2y; cam.rz = r2z;
  cam.ux = u2x; cam.uy = u2y; cam.uz = u2z;
}

export function project(cam, px, py, pz, W, H) {
  const dx = px - cam.x, dy = py - cam.y, dz = pz - cam.z;
  const cx = dx * cam.rx + dy * cam.ry + dz * cam.rz;
  const cy = dx * cam.ux + dy * cam.uy + dz * cam.uz;
  const cz = dx * cam.fx + dy * cam.fy + dz * cam.fz;
  if (cz < 6) return null;
  const s = cam.focal / cz;
  return { x: W / 2 + cx * s, y: H * 0.54 - cy * s, s, d: cz };
}

// ---- Sky ----

export function drawSky(ctx, W, H, sky, heading, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  g.addColorStop(0, sky.top);
  g.addColorStop(0.55, sky.mid);
  g.addColorStop(1, sky.horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.62 + 2);

  // Sun with a soft glow.
  const sx = W * sky.sunX, sy = H * sky.sunY;
  const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 130);
  glow.addColorStop(0, sky.sunGlow);
  glow.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 140, sy - 140, 280, 280);
  ctx.fillStyle = sky.sun;
  ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.fill();

  // A soft haze band at the horizon so the sky melts into the valley haze.
  const horizonY = H * 0.54;
  const haze = ctx.createLinearGradient(0, horizonY - 46, 0, horizonY + 10);
  haze.addColorStop(0, 'rgba(255,255,255,0)');
  haze.addColorStop(1, `rgba(${sky.fog[0]},${sky.fog[1]},${sky.fog[2]},0.55)`);
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizonY - 46, W, 56);
}

// ---- Terrain ----

export function drawTerrain(ctx, cam, W, H, sky, trees, t) {
  const fog = sky.fog;
  const step = 95;
  const zStart = Math.floor((cam.z + 2500) / step) * step;
  const zEnd = cam.z - 160;
  const xHalf = 1500;
  // Rows far -> near (painter's algorithm).
  for (let z = zStart; z > zEnd; z -= step) {
    for (let x = -xHalf; x < xHalf; x += step) {
      const x2 = x + step, z2 = z - step;
      const h00 = heightAt(x, z), h10 = heightAt(x2, z);
      const h01 = heightAt(x, z2), h11 = heightAt(x2, z2);
      const p00 = project(cam, x, h00, z, W, H);
      const p10 = project(cam, x2, h10, z, W, H);
      const p01 = project(cam, x, h01, z2, W, H);
      const p11 = project(cam, x2, h11, z2, W, H);
      if (!p00 || !p10 || !p01 || !p11) continue;
      // Cull quads entirely off screen.
      const minX = Math.min(p00.x, p10.x, p01.x, p11.x);
      const maxX = Math.max(p00.x, p10.x, p01.x, p11.x);
      const minY = Math.min(p00.y, p10.y, p01.y, p11.y);
      const maxY = Math.max(p00.y, p10.y, p01.y, p11.y);
      if (maxX < -40 || minX > W + 40 || maxY < -40 || minY > H + 40) continue;
      const midH = (h00 + h10 + h01 + h11) / 4;
      const slope = Math.abs(h10 - h00) + Math.abs(h01 - h00);
      const detail = fbm(x * 0.01, z * 0.01, 9) * 0.5 + 0.5;
      const dist = (p00.d + p10.d + p01.d + p11.d) / 4;
      const f = smoothstep(sky.fogNear, sky.fogFar, dist);
      // Directional shading: slopes facing the sun read bright, the rest shade.
      const gx = (h10 - h00) / step;
      const gz = (h01 - h00) / step;
      const shade = clamp(1 - gx * 1.5, 0.8, 1.14) * clamp(1 - gz * 0.5, 0.92, 1.06) * (0.94 + detail * 0.12);
      const base = groundColor(midH, slope / step, detail);
      const lit = base.map((c) => clamp(Math.round(c * shade), 0, 255));
      const col = fogMix(lit, fog, f * 0.92);
      ctx.fillStyle = rgb(col);
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y); ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y); ctx.lineTo(p01.x, p01.y);
      ctx.closePath(); ctx.fill();
    }
  }

  // River: a narrow blue ribbon down the valley floor.
  ctx.fillStyle = rgba([58, 118, 168], 0.88);
  for (let z = Math.floor((cam.z + 2400) / 160) * 160; z > cam.z - 160; z -= 160) {
    const rx = riverX(z), rx2 = riverX(z - 160);
    const a = project(cam, rx - 13, 1.5, z, W, H);
    const b = project(cam, rx + 13, 1.5, z, W, H);
    const c = project(cam, rx2 + 13, 1.5, z - 160, W, H);
    const d = project(cam, rx2 - 13, 1.5, z - 160, W, H);
    if (!a || !b || !c || !d) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath(); ctx.fill();
  }
}

export function drawRunway(ctx, cam, W, H, sky, strip) {
  const halfW = strip.width / 2, halfL = strip.length / 2;
  const y = 2.4;
  const corners = [
    project(cam, strip.x - halfW, y, strip.z - halfL, W, H),
    project(cam, strip.x + halfW, y, strip.z - halfL, W, H),
    project(cam, strip.x + halfW, y, strip.z + halfL, W, H),
    project(cam, strip.x - halfW, y, strip.z + halfL, W, H),
  ];
  if (corners.some((p) => !p)) return;
  // Asphalt.
  ctx.fillStyle = '#3c3f45';
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y); ctx.lineTo(corners[1].x, corners[1].y);
  ctx.lineTo(corners[2].x, corners[2].y); ctx.lineTo(corners[3].x, corners[3].y);
  ctx.closePath(); ctx.fill();
  // Centreline dashes.
  ctx.strokeStyle = '#f2f2e8'; ctx.lineWidth = 2;
  for (let dz = -halfL + 30; dz < halfL - 20; dz += 60) {
    const a = project(cam, strip.x, y + 0.2, strip.z + dz, W, H);
    const b = project(cam, strip.x, y + 0.2, strip.z + dz + 28, W, H);
    if (!a || !b) continue;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // Threshold bars at both ends.
  ctx.strokeStyle = '#f2f2e8'; ctx.lineWidth = 3;
  for (const end of [-halfL + 14, halfL - 14]) {
    const a = project(cam, strip.x - halfW + 4, y + 0.2, strip.z + end, W, H);
    const b = project(cam, strip.x + halfW - 4, y + 0.2, strip.z + end, W, H);
    if (!a || !b) continue;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // Edge lights at dusk / golden hour.
  if (sky.runwayLights) {
    for (let dz = -halfL + 10; dz <= halfL - 10; dz += 46) {
      for (const side of [-1, 1]) {
        const p = project(cam, strip.x + side * halfW, y + 1, strip.z + dz, W, H);
        if (!p) continue;
        ctx.fillStyle = 'rgba(255,220,120,0.95)';
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, 5 * p.s / 900), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // Strip name board near the threshold.
  const label = project(cam, strip.x, y + 4, strip.z - halfL - 60, W, H);
  if (label && label.d < 1600) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(20,26,34,0.75)';
    const tw = ctx.measureText(strip.name).width;
    ctx.fillRect(label.x - tw / 2 - 8, label.y - 14, tw + 16, 22);
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(strip.name, label.x, label.y + 2);
  }
}

// ---- Rings, trees, cabins, clouds ----

export function drawRing(ctx, cam, W, H, ring, t, next) {
  const pts = [];
  const segs = 22;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    // Ring stands vertical, facing along its heading.
    const lx = Math.cos(a) * ring.r;
    const ly = Math.sin(a) * ring.r;
    const wx = ring.x + lx * Math.cos(ring.heading);
    const wz = ring.z - lx * Math.sin(ring.heading);
    const p = project(cam, wx, ring.y + ly, wz, W, H);
    if (p) pts.push(p);
  }
  if (pts.length < 4) return;
  const d = pts[0].d;
  const pulse = 0.75 + 0.25 * Math.sin(t * 3 + ring.x);
  const col = ring.passed ? [120, 220, 140] : next ? [255, 196, 66] : [90, 180, 255];
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(col, 0.28 * pulse);
  ctx.lineWidth = Math.max(3, 14 * pts[0].s / 800);
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath(); ctx.stroke();
  ctx.strokeStyle = rgb(col);
  ctx.lineWidth = Math.max(2, 6 * pts[0].s / 800);
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath(); ctx.stroke();
  // Distance + label at the ring's top.
  const top = project(cam, ring.x, ring.y + ring.r + 14, ring.z, W, H);
  if (top && d < 2200) {
    ctx.fillStyle = 'rgba(16,22,30,0.7)';
    const label = ring.passed ? 'CLEAR' : `${Math.round(d)} m`;
    ctx.font = 'bold 13px system-ui, sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillRect(top.x - tw / 2 - 7, top.y - 13, tw + 14, 20);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(label, top.x, top.y + 2);
  }
}

export function drawTrees(ctx, cam, W, H, trees, sky) {
  // Draw near -> far is wrong for overlap; sort far -> near, capped.
  const visible = [];
  for (const tr of trees) {
    const dx = tr.x - cam.x, dz = tr.z - cam.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > 2200 * 2200) continue;
    const p = project(cam, tr.x, tr.y, tr.z, W, H);
    if (!p || p.x < -60 || p.x > W + 60 || p.y < -40 || p.y > H + 40) continue;
    visible.push({ tr, p, d: p.d });
  }
  visible.sort((a, b) => b.d - a.d);
  for (const { tr, p } of visible.slice(0, 380)) {
    const h = 34 * tr.s * p.s / 60;
    if (h < 2) continue;
    const w = h * 0.42;
    const shade = 0.8 + tr.tint * 0.35;
    const green = [Math.round(34 * shade), Math.round(92 * shade), Math.round(48 * shade)];
    ctx.fillStyle = rgb(green);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h);
    ctx.lineTo(p.x - w, p.y);
    ctx.lineTo(p.x + w, p.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgb([Math.round(24 * shade), Math.round(70 * shade), Math.round(36 * shade)]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h * 1.35);
    ctx.lineTo(p.x - w * 0.7, p.y - h * 0.45);
    ctx.lineTo(p.x + w * 0.7, p.y - h * 0.45);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(p.x - Math.max(1, w * 0.08), p.y - h * 0.12, Math.max(2, w * 0.16), h * 0.12);
  }
}

export function drawCabins(ctx, cam, W, H, cabins) {
  for (const c of cabins) {
    const p = project(cam, c.x, c.y, c.z, W, H);
    if (!p || p.d > 2400) continue;
    const s = p.s / 60;
    const w = c.w * s, h = c.h * s;
    if (w < 3) continue;
    ctx.fillStyle = '#7a5a38';
    ctx.fillRect(p.x - w / 2, p.y - h, w, h);
    ctx.fillStyle = '#4a3220';
    ctx.beginPath();
    ctx.moveTo(p.x - w / 2 - 2, p.y - h);
    ctx.lineTo(p.x, p.y - h - h * 0.7);
    ctx.lineTo(p.x + w / 2 + 2, p.y - h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,130,0.95)';
    ctx.fillRect(p.x - w * 0.18, p.y - h * 0.62, w * 0.16, h * 0.3);
  }
}

export function drawClouds(ctx, cam, W, H, clouds, t, sky) {
  for (const c of clouds) {
    const cx = c.x + c.drift * t;
    const p = project(cam, cx, c.y, c.z, W, H);
    if (!p) continue;
    const s = p.s / 60;
    const w = c.s * s;
    if (w < 8 || p.x < -w || p.x > W + w) continue;
    ctx.fillStyle = sky.name === 'Dusk' ? 'rgba(226,196,205,0.75)' : 'rgba(255,255,255,0.85)';
    for (const [ox, oy, r] of [[-0.5, 0, 0.42], [0, -0.18, 0.55], [0.5, 0, 0.4], [0.1, 0.08, 0.5]]) {
      ctx.beginPath();
      ctx.ellipse(p.x + ox * w, p.y + oy * w, r * w, r * w * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---- The plane (screen-space vector drawing, chase view) ----

export function drawPlane(ctx, W, H, plane, t) {
  const cx = W / 2, cy = H * 0.56;
  const scale = Math.min(W, H) / 720;
  const bank = -plane.roll * 0.85;
  const pitchBob = clamp(-plane.pitch * 0.4, -0.08, 0.08);
  ctx.save();
  ctx.translate(cx, cy + pitchBob * 120 * scale);
  ctx.rotate(bank);
  ctx.scale(scale, scale);

  // Tail.
  ctx.fillStyle = '#b8322a';
  ctx.beginPath(); ctx.moveTo(-7, -58); ctx.lineTo(-30, -94); ctx.lineTo(-26, -102); ctx.lineTo(2, -72); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(7, -58); ctx.lineTo(30, -94); ctx.lineTo(26, -102); ctx.lineTo(-2, -72); ctx.closePath(); ctx.fill();
  // Fuselage (slim, seen from behind-above).
  const body = ctx.createLinearGradient(0, -110, 0, 40);
  body.addColorStop(0, '#f4f2ea'); body.addColorStop(0.55, '#e8e2d2'); body.addColorStop(1, '#c9bfa5');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -118);
  ctx.bezierCurveTo(13, -100, 16, -60, 14, -10);
  ctx.bezierCurveTo(13, 18, 8, 34, 0, 38);
  ctx.bezierCurveTo(-8, 34, -13, 18, -14, -10);
  ctx.bezierCurveTo(-16, -60, -13, -100, 0, -118);
  ctx.closePath(); ctx.fill();
  // Red cheatline.
  ctx.fillStyle = '#b8322a';
  ctx.beginPath();
  ctx.moveTo(-13, -58); ctx.quadraticCurveTo(0, -50, 13, -58);
  ctx.lineTo(13, -46); ctx.quadraticCurveTo(0, -38, -13, -46);
  ctx.closePath(); ctx.fill();
  // Wings (high wing, seen from behind-above).
  ctx.fillStyle = '#d8433a';
  ctx.beginPath(); ctx.moveTo(-16, -78); ctx.lineTo(-148, -44); ctx.lineTo(-152, -30); ctx.lineTo(-14, -58); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(16, -78); ctx.lineTo(148, -44); ctx.lineTo(152, -30); ctx.lineTo(14, -58); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f4f2ea';
  ctx.beginPath(); ctx.moveTo(-148, -44); ctx.lineTo(-152, -30); ctx.lineTo(-118, -34); ctx.lineTo(-116, -42); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(148, -44); ctx.lineTo(152, -30); ctx.lineTo(118, -34); ctx.lineTo(116, -42); ctx.closePath(); ctx.fill();
  // Cockpit windows.
  ctx.fillStyle = '#20344e';
  ctx.beginPath(); ctx.moveTo(-11, -96); ctx.lineTo(11, -96); ctx.lineTo(9, -74); ctx.lineTo(-9, -74); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.55)';
  ctx.beginPath(); ctx.moveTo(-8, -93); ctx.lineTo(2, -93); ctx.lineTo(1, -78); ctx.lineTo(-7, -78); ctx.closePath(); ctx.fill();
  // Propeller (spinning disc + blades).
  const prop = (t * 28) % (Math.PI * 2);
  ctx.strokeStyle = 'rgba(40,40,44,0.75)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-Math.sin(prop) * 26, -118 - Math.cos(prop) * 6);
  ctx.lineTo(Math.sin(prop) * 26, -118 + Math.cos(prop) * 6);
  ctx.stroke();
  ctx.fillStyle = 'rgba(60,60,66,0.28)';
  ctx.beginPath(); ctx.ellipse(0, -118, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b2b2e';
  ctx.beginPath(); ctx.arc(0, -118, 6, 0, Math.PI * 2); ctx.fill();
  // Nav lights.
  const blink = Math.sin(t * 4) > 0;
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath(); ctx.arc(-150, -37, blink ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#34d17b';
  ctx.beginPath(); ctx.arc(150, -37, blink ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, -106, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
