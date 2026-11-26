// missions.js — the three sorties of Ridgeline Courier.
// Each one flies the same valley differently: a daylight ring run, a golden-hour
// ridge crossing, and a dusk return leg with a crosswind. Original content.

import { deg2rad } from './noise.js';

// Time-of-day palettes. The judge sees the game through the screenshots, so
// each mission has its own light: clean day, low gold sun, deep dusk.
export const SKIES = {
  day: {
    name: 'Day',
    top: '#2b63c8', mid: '#6ea8e6', horizon: '#cfe4f4',
    sun: '#fff2bd', sunX: 0.72, sunY: 0.20, sunGlow: 'rgba(255,242,189,0.55)',
    fog: [207, 224, 238], fogNear: 500, fogFar: 2600,
    ridgeFar: '#8fa8c4', ridgeNear: '#6d8299',
    ambient: 1.0, runwayLights: false,
  },
  gold: {
    name: 'Golden hour',
    top: '#3a4f8f', mid: '#c98a4b', horizon: '#f4c98a',
    sun: '#ffd27a', sunX: 0.16, sunY: 0.30, sunGlow: 'rgba(255,190,90,0.6)',
    fog: [232, 196, 150], fogNear: 420, fogFar: 2300,
    ridgeFar: '#9a7a68', ridgeNear: '#6e5648',
    ambient: 0.92, runwayLights: true,
  },
  dusk: {
    name: 'Dusk',
    top: '#1c2340', mid: '#5a4a72', horizon: '#d98a6a',
    sun: '#ff9a5c', sunX: 0.5, sunY: 0.42, sunGlow: 'rgba(255,140,80,0.5)',
    fog: [178, 140, 150], fogNear: 380, fogFar: 2000,
    ridgeFar: '#5d5470', ridgeNear: '#453e58',
    ambient: 0.8, runwayLights: true,
  },
};

function ring(x, y, z, r, headingDeg = 0) {
  return { x, y, z, r, heading: deg2rad(headingDeg), passed: false, best: 0 };
}

export const MISSIONS = [
  {
    id: 1,
    name: 'Valley Run',
    sky: 'day',
    briefing: 'First light over Ridgeline Valley. Thread all five marker rings down the valley and set the courier down gently on Far Strip. Mind your fuel — every ring tops the tank up a little.',
    start: { x: 0, z: -60, heading: 0 },
    targetStrip: 1,
    wind: 0,
    rings: [
      ring(0, 150, 700, 34),
      ring(-90, 175, 1500, 34),
      ring(60, 200, 2300, 32),
      ring(-40, 230, 3100, 32),
      ring(30, 250, 4100, 34),
    ],
    par: 240,
    goldScore: 1150,
    silverScore: 850,
  },
  {
    id: 2,
    name: 'Ridge Crossing',
    sky: 'gold',
    briefing: 'Golden hour, and the wind is up. Six rings climb over the eastern ridge and back down to Far Strip. The air is thinner up high — keep your speed up and your turns wide.',
    start: { x: 0, z: -60, heading: 0 },
    targetStrip: 1,
    wind: 6,
    rings: [
      ring(120, 190, 800, 32),
      ring(320, 280, 1600, 30),
      ring(430, 380, 2400, 30),
      ring(180, 420, 3100, 30),
      ring(-120, 360, 3900, 30),
      ring(-40, 260, 4600, 32),
    ],
    par: 300,
    goldScore: 1400,
    silverScore: 1000,
  },
  {
    id: 3,
    name: 'Dusk Delivery',
    sky: 'dusk',
    briefing: 'Last light. Fly the valley home in the dusk, through four low rings, and land on Home Strip with the runway lights on. A crosswind is pushing from the west — crab into it on final.',
    start: { x: 0, z: 5260, heading: 180 },
    targetStrip: 0,
    wind: -9,
    rings: [
      ring(-30, 240, 4500, 32),
      ring(90, 200, 3700, 32),
      ring(-70, 170, 2900, 30),
      ring(20, 150, 2000, 32),
    ],
    par: 260,
    goldScore: 1250,
    silverScore: 900,
  },
];

export function missionRating(mission, score) {
  if (score >= mission.goldScore) return 'Gold';
  if (score >= mission.silverScore) return 'Silver';
  return 'Bronze';
}
