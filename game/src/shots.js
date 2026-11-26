// shots.js — deterministic scene setups for the entry's screenshots.
// ?shot=cover | rings | landing | complete puts the game in a staged, frozen
// state (real renders of this game's own code) so the screenshots are repeatable.
// Normal play ignores the parameter entirely.

import { deg2rad } from './noise.js';
import { heightAt, STRIPS } from './terrain.js';
import { newPlane } from './flight.js';
import { MISSIONS } from './missions.js';

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  return q.get('shot');
}

function placePlane(G, x, y, z, headingDeg, speed, throttle, vspeed = 0) {
  const p = newPlane(x, z, headingDeg);
  p.y = y;
  p.speed = speed;
  p.throttle = throttle;
  p.vspeed = vspeed;
  p.onGround = false;
  p.pitch = deg2rad(2);
  G.plane = p;
  G.cam.x = p.x - Math.sin(p.heading) * 30;
  G.cam.y = p.y + 8;
  G.cam.z = p.z - Math.cos(p.heading) * 30;
}

// Apply a shot setup to the game state. Returns the shot name or null.
export function applyShot(G, name) {
  if (!name) return null;
  G.shotMode = true;
  const ground = (x, z) => heightAt(x, z);
  if (name === 'cover') {
    // Sortie 1, daylight: last ring and Far Strip both ahead, valley below.
    G.missionIndex = 0;
    G.mission = MISSIONS[0];
    G.mission.rings.forEach((r, i) => { r.passed = i < 4; });
    placePlane(G, 30, ground(30, 3800) + 215, 3800, 2, 74, 0.8, -1.5);
    G.plane.roll = deg2rad(6);
    G.score = 480;
    G.missionTime = 192;
  } else if (name === 'rings') {
    // Sortie 2, golden hour: banking toward the next ring over the ridge.
    G.missionIndex = 1;
    G.mission = MISSIONS[1];
    G.mission.rings.forEach((r, i) => { r.passed = i < 2; });
    placePlane(G, 300, 360, 2100, 24, 84, 0.9, 2.5);
    G.plane.roll = deg2rad(-18);
    G.plane.pitch = deg2rad(4);
    G.score = 460;
    G.missionTime = 132;
  } else if (name === 'landing') {
    // Sortie 3, dusk: on final to Home Strip, runway lights on, crabbing
    // slightly into the crosswind with the river off to the side.
    G.missionIndex = 2;
    G.mission = MISSIONS[2];
    G.mission.rings.forEach((r) => { r.passed = true; });
    placePlane(G, -60, ground(-60, -1050) + 118, -1050, 4, 52, 0.32, -4.5);
    G.plane.pitch = deg2rad(-5);
    G.plane.roll = deg2rad(-3);
    G.score = 980;
    G.missionTime = 214;
  } else if (name === 'complete') {
    // Sortie 1 finished: parked on Far Strip with the debrief on screen.
    G.missionIndex = 0;
    G.mission = MISSIONS[0];
    G.mission.rings.forEach((r) => { r.passed = true; });
    const s = STRIPS[1];
    const p = newPlane(s.x, s.z + 120, 0);
    p.y = ground(s.x, s.z + 120) + 2.2;
    p.speed = 0; p.throttle = 0; p.onGround = true;
    G.plane = p;
    G.score = 1240;
    G.missionTime = 226;
    G.mode = 'complete';
    G.result = {
      rating: 'Gold', rings: 5, ringsTotal: 5, time: 226,
      timeBonus: 28, landingBonus: 500, damage: 0, fuelLeft: 41,
    };
    // Three-quarter view of the parked plane, seen past the debrief card
    // (the card sits left in this shot; see body.shot-complete in index.html).
    document.body.classList.add('shot-complete');
    G.camOverride = {
      eye: [p.x - 20, p.y + 16, p.z - 55],
      target: [p.x, p.y + 2, p.z + 80],
    };
    G.cam.x = p.x - 26; G.cam.y = p.y + 12; G.cam.z = p.z - 42;
  } else {
    return null;
  }
  G.mode = G.mode === 'complete' ? 'complete' : 'fly';
  G.frozen = true;
  return name;
}
