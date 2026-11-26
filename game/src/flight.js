// flight.js — the arcade flight model for Ridgeline Courier.
// Speeds are in metres per second internally; the HUD shows knots and feet.
// A bush plane: honest stall, bank-to-turn, fuel that matters, landings that
// reward a gentle touch. Original code written for this game.

import { clamp, deg2rad, wrapAngle } from './noise.js';
import { heightAt, clampWorld } from './terrain.js';

export const PLANE = {
  minFlySpeed: 34,     // m/s; below this the wing stops flying
  cruiseSpeed: 78,     // m/s at full throttle, level
  maxPitch: deg2rad(26),
  maxRoll: deg2rad(58),
  fuelCapacity: 100,
  fuelBurnBase: 0.22,  // per second at idle
  fuelBurnThrottle: 0.85, // per second extra at full throttle
};

export function newPlane(x, z, headingDeg) {
  return {
    x, z,
    y: heightAt(x, z) + 3,
    heading: deg2rad(headingDeg),
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    vspeed: 0,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    onGround: true,
    landed: false,
    crashed: false,
    airTime: 0,
    maxAlt: 0,
  };
}

// input: { throttleUp, throttleDown, pitchUp, pitchDown, rollLeft, rollRight, steerX, steerY }
// steerX/steerY come from mouse drag (-1..1). Returns events: { stalled, touchdown, crash, bounced }
export function stepFlight(p, input, dt, events) {
  if (p.crashed || p.landed) return;

  // --- Throttle ---
  if (input.throttleUp) p.throttle = clamp(p.throttle + 0.55 * dt, 0, 1);
  if (input.throttleDown) p.throttle = clamp(p.throttle - 0.7 * dt, 0, 1);

  // --- Attitude ---
  const controlAuthority = clamp(p.speed / PLANE.minFlySpeed, 0.25, 1);
  let pitchIn = 0, rollIn = 0;
  if (input.pitchUp) pitchIn += 1;
  if (input.pitchDown) pitchIn -= 1;
  if (input.rollLeft) rollIn -= 1;
  if (input.rollRight) rollIn += 1;
  if (input.steerX !== 0 || input.steerY !== 0) {
    rollIn += input.steerX;
    pitchIn -= input.steerY;
  }
  const pitchRate = deg2rad(26) * controlAuthority;
  const rollRate = deg2rad(72) * controlAuthority;
  p.pitch = clamp(p.pitch + pitchIn * pitchRate * dt, -PLANE.maxPitch, PLANE.maxPitch);
  // Bank toward the input; ease back toward level hands-off.
  const targetRoll = clamp(rollIn, -1, 1) * PLANE.maxRoll;
  const rollBlend = rollIn !== 0 ? 2.6 : 0.9;
  p.roll += (targetRoll - p.roll) * Math.min(1, rollBlend * dt);
  if (!p.onGround) {
    // Coordinated turn: bank turns the nose.
    const turnRate = (9.81 * Math.tan(p.roll)) / Math.max(p.speed, 20);
    p.heading = wrapAngle(p.heading + turnRate * dt);
  }

  // --- Speed ---
  const levelSpeed = PLANE.minFlySpeed + p.throttle * (PLANE.cruiseSpeed - PLANE.minFlySpeed);
  // Climbing costs speed, diving buys it.
  const pitchEffect = -Math.sin(p.pitch) * 26;
  const targetSpeed = clamp(levelSpeed + pitchEffect, 0, 120);
  const accel = p.onGround ? 8 : 9;
  p.speed += clamp(targetSpeed - p.speed, -accel * dt, accel * dt);
  if (p.speed < 4 && p.throttle < 0.05) p.speed = Math.max(0, p.speed - 6 * dt);

  // --- Vertical motion ---
  const stalled = !p.onGround && p.speed < PLANE.minFlySpeed;
  let sink = 5.5;                       // the wing always wants to descend a little
  if (stalled) sink += (PLANE.minFlySpeed - p.speed) * 0.55;
  if (p.onGround) sink = 0;
  const climb = p.onGround ? 0 : p.speed * Math.sin(p.pitch);
  p.vspeed = climb - sink;
  // Ground effect: the last few metres cushion the descent.
  const groundH = heightAt(p.x, p.z);
  const agl = p.y - groundH;
  if (!p.onGround && agl < 12 && p.vspeed < 0) p.vspeed *= 0.55;
  p.y += p.vspeed * dt;

  // --- Horizontal motion ---
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  p.x += fx * p.speed * Math.cos(p.pitch) * dt;
  p.z += fz * p.speed * Math.cos(p.pitch) * dt;
  const clamped = clampWorld(p.x, p.z);
  if (clamped.x !== p.x || clamped.z !== p.z) {
    // Soft edge of the world: nudge the nose back toward the valley.
    p.x = clamped.x; p.z = clamped.z;
    p.heading = wrapAngle(p.heading + Math.PI * 0.4 * dt * 10 * 0.1);
    events.edge = true;
  }

  // --- Fuel ---
  if (p.throttle > 0.02 || p.speed > 5) {
    p.fuel = Math.max(0, p.fuel - (PLANE.fuelBurnBase + PLANE.fuelBurnThrottle * p.throttle) * dt);
    if (p.fuel <= 0) { p.throttle = 0; events.fuelEmpty = true; }
  }

  if (!p.onGround) {
    p.airTime += dt;
    p.maxAlt = Math.max(p.maxAlt, p.y);
  }

  // --- Ground contact ---
  const ground = heightAt(p.x, p.z);
  if (p.y <= ground + 2.2) {
    p.y = ground + 2.2;
    if (p.onGround) {
      // Rolling on the ground: drag slows the plane faster than the
      // propeller pulls, so cutting power always brings her to a stop.
      p.speed = Math.max(0, p.speed - 16 * dt);
      if (p.speed < 2) p.speed = 0;
    } else {
      const hard = p.vspeed < -9 || Math.abs(p.roll) > deg2rad(38) || p.speed > 108;
      const rough = p.vspeed < -5.5;
      if (hard) {
        p.crashed = true;
        events.crash = 'terrain';
      } else {
        // Touchdown (or a firm bounce).
        p.onGround = true;
        p.pitch = 0;
        p.roll *= 0.4;
        if (rough) {
          p.damage = Math.min(100, p.damage + 22);
          events.bounced = true;
        } else {
          events.touchdown = true;
        }
      }
    }
  } else if (p.onGround && p.speed > PLANE.minFlySpeed * 1.08 && p.pitch > deg2rad(4)) {
    // Rotate: lift off.
    p.onGround = false;
    events.takeoff = true;
  }

  if (stalled) events.stalled = true;
  events.agl = p.y - heightAt(p.x, p.z);
}

export function knots(ms) { return ms * 1.944; }
export function feet(m) { return m * 3.281; }
