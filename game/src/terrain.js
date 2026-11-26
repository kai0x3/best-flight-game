// terrain.js — the alpine valley of Ridgeline Courier: a procedural heightfield,
// a carved river, two grass airstrips, pine forests, cabins and clouds.
// All world data is generated from fixed seeds, so every run looks the same.

import { fbm, hash2, clamp, lerp, smoothstep } from './noise.js';

export const WORLD = {
  minX: -1700, maxX: 1700,
  minZ: -700, maxZ: 5900,
};

// The two airstrips. heading 0 = runway runs north (+z).
export const STRIPS = [
  { name: 'Home Strip', x: 0, z: 0, heading: 0, length: 460, width: 40 },
  { name: 'Far Strip', x: 0, z: 5200, heading: 0, length: 460, width: 40 },
];

// The river meanders down the valley floor.
export function riverX(z) {
  return 95 * Math.sin(z * 0.0006 + 1.3) + 30 * Math.sin(z * 0.0016 + 0.4);
}

export function heightAt(x, z) {
  // Rolling hills on the valley floor.
  let h = 14 * fbm(x * 0.004 + 9.2, z * 0.004, 7);
  // Valley walls: rise steeply once |x| leaves the flat floor.
  const wall = smoothstep(150, 780, Math.abs(x));
  const ridge = 260 + 520 * (0.5 + 0.5 * fbm(x * 0.0016, z * 0.0016, 3));
  h += ridge * Math.pow(wall, 1.6);
  // Extra ridge swell far up the valley so the horizon never looks flat.
  h += 120 * Math.pow(smoothstep(2400, 5200, z), 2) * (0.5 + 0.5 * fbm(x * 0.001, z * 0.001, 11));
  // Carve the river channel.
  const rb = smoothstep(24, 64, Math.abs(x - riverX(z)));
  h = lerp(-2.5, h, rb);
  // Flatten the ground around each airstrip.
  for (const s of STRIPS) {
    const dx = (x - s.x) / 320, dz = (z - s.z) / 320;
    const d = Math.sqrt(dx * dx + dz * dz);
    const f = smoothstep(0.55, 1.05, d);
    h *= 0.08 + 0.92 * f;
  }
  return h;
}

// Slope estimate, used to keep trees off cliffs.
export function slopeAt(x, z) {
  const e = 6;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.sqrt(dx * dx + dz * dz) / (2 * e);
}

// ---- Static world objects, generated once from fixed seeds ----

export function makeTrees() {
  const trees = [];
  for (let x = -1500; x <= 1500; x += 85) {
    for (let z = -600; z <= 5800; z += 85) {
      const r = hash2(Math.round(x / 85), Math.round(z / 85), 21);
      if (r > 0.5) continue;
      const jx = x + (hash2(Math.round(x / 85), Math.round(z / 85), 22) - 0.5) * 70;
      const jz = z + (hash2(Math.round(x / 85), Math.round(z / 85), 23) - 0.5) * 70;
      const h = heightAt(jx, jz);
      if (h < 3 || h > 320) continue;
      if (slopeAt(jx, jz) > 1.0) continue;
      // Keep the strips and the river clear.
      let nearStrip = false;
      for (const s of STRIPS) {
        if (Math.abs(jx - s.x) < 90 && Math.abs(jz - s.z) < 300) nearStrip = true;
      }
      if (nearStrip) continue;
      if (Math.abs(jx - riverX(jz)) < 34) continue;
      const s = 0.75 + hash2(Math.round(x / 85), Math.round(z / 85), 24) * 0.9;
      trees.push({ x: jx, z: jz, y: h, s, tint: hash2(Math.round(x / 85), Math.round(z / 85), 25) });
    }
  }
  return trees;
}

export const CABINS = [
  { x: 120, z: -140, y: 0, rot: 0.4, w: 26, d: 20, h: 12 },
  { x: -150, z: 90, y: 0, rot: -0.3, w: 22, d: 18, h: 10 },
  { x: 170, z: 240, y: 0, rot: 0.9, w: 20, d: 16, h: 9 },
  { x: -130, z: 5050, y: 0, rot: 0.2, w: 26, d: 20, h: 12 },
  { x: 150, z: 5330, y: 0, rot: -0.6, w: 22, d: 18, h: 10 },
];
for (const c of CABINS) c.y = heightAt(c.x, c.z);

export function makeClouds() {
  const clouds = [];
  const rng = [];
  for (let i = 0; i < 16; i++) {
    const a = hash2(i, 3, 31), b = hash2(i, 7, 32), c = hash2(i, 11, 33);
    clouds.push({
      x: -1600 + a * 3200,
      y: 520 + b * 260,
      z: -500 + c * 6200,
      s: 120 + a * 160,
      drift: 2 + b * 3,
    });
  }
  return clouds;
}

// Colour of the ground at a height, before fog is applied.
export function groundColor(h, slope, t) {
  // t: 0..1 detail noise for variation.
  if (h < 1.5) return [116, 148, 84];            // valley grass
  if (h > 520) return [232, 236, 241];           // snow
  if (h > 430) {                                 // snowline blend
    const f = (h - 430) / 90;
    return [Math.round(lerp(122, 232, f)), Math.round(lerp(110, 236, f)), Math.round(lerp(96, 241, f))];
  }
  if (h > 380 || slope > 0.9) return [122, 110, 96]; // rock
  if (h > 180) return [96, 122, 78];             // high meadow
  const g = 118 + t * 22;
  return [Math.round(g * 0.82), Math.round(g), Math.round(g * 0.62)];
}

export function fogMix(color, fog, f) {
  return [
    Math.round(lerp(color[0], fog[0], f)),
    Math.round(lerp(color[1], fog[1], f)),
    Math.round(lerp(color[2], fog[2], f)),
  ];
}

export function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
export function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

export function clampWorld(x, z) {
  return {
    x: clamp(x, WORLD.minX, WORLD.maxX),
    z: clamp(z, WORLD.minZ, WORLD.maxZ),
  };
}
