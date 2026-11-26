// hud.js — the instrument panel of Ridgeline Courier, drawn on the canvas so it
// is part of every screenshot: compass tape, speed and altitude tapes, attitude
// indicator, throttle / fuel / damage, mission panel and warnings.

import { clamp, lerp, deg2rad, rad2deg, wrapAngle } from './noise.js';
import { heightAt } from './terrain.js';
import { knots, feet } from './flight.js';

function panel(ctx, x, y, w, h, alpha = 0.62) {
  ctx.fillStyle = `rgba(12,18,28,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function headingLabel(deg) {
  const d = ((Math.round(deg / 10) * 10) % 360 + 360) % 360;
  if (d === 0) return 'N';
  if (d === 90) return 'E';
  if (d === 180) return 'S';
  if (d === 270) return 'W';
  return String(d / 10);
}

export function drawHUD(ctx, W, H, G) {
  const p = G.plane;
  const m = G.mission;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const hdgDeg = (rad2deg(p.heading) + 360) % 360;
  const spdKt = Math.round(knots(p.speed));
  const altFt = Math.round(feet(p.y));
  const aglFt = Math.max(0, Math.round(feet(p.y - heightAt(p.x, p.z))));

  // --- Compass tape (top centre) ---
  const cw = Math.min(460, W * 0.42), cx = W / 2, cy = 30;
  panel(ctx, cx - cw / 2, cy - 20, cw, 40);
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - cw / 2, cy - 20, cw, 40); ctx.clip();
  // Tick every 10°, labelled every 30°, positioned from absolute degrees so
  // a label is always in view whatever the heading.
  const halfSpan = 60;
  const firstDeg = Math.ceil((hdgDeg - halfSpan) / 10) * 10;
  for (let deg = firstDeg; deg <= hdgDeg + halfSpan; deg += 10) {
    const rel = ((deg - hdgDeg + 540) % 360) - 180;
    const x = cx + (rel / halfSpan) * (cw / 2 - 8);
    const norm = ((deg % 360) + 360) % 360;
    const major = norm % 30 === 0;
    ctx.strokeStyle = major ? '#ffffff' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(x, cy + 12); ctx.lineTo(x, cy + (major ? 2 : 7)); ctx.stroke();
    if (major) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(headingLabel(norm), x, cy - 8);
    }
  }
  ctx.restore();
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`${String(Math.round(hdgDeg)).padStart(3, '0')}°`, cx, cy + 30);
  // Centre caret.
  ctx.fillStyle = '#ffd24d';
  ctx.beginPath(); ctx.moveTo(cx - 6, cy - 20); ctx.lineTo(cx + 6, cy - 20); ctx.lineTo(cx, cy - 12); ctx.closePath(); ctx.fill();

  // --- Airspeed tape (left) ---
  const tw = 74, th = 190, tx = 14, ty = H / 2 - th / 2;
  panel(ctx, tx, ty, tw, th);
  ctx.save();
  ctx.beginPath(); ctx.rect(tx, ty, tw, th); ctx.clip();
  for (let v = spdKt - 60; v <= spdKt + 60; v += 10) {
    if (v < 0) continue;
    const y = ty + th / 2 - (v - spdKt) * 1.4;
    if (y < ty + 4 || y > ty + th - 4) continue;
    const major = v % 20 === 0;
    ctx.strokeStyle = major ? '#fff' : 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.moveTo(tx + tw - 14, y); ctx.lineTo(tx + tw - (major ? 6 : 10), y); ctx.stroke();
    if (major) {
      ctx.fillStyle = '#fff'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(String(v), tx + tw - 18, y);
    }
  }
  ctx.restore();
  // Centre readout on a highlight chip so it never collides with tape marks.
  ctx.fillStyle = 'rgba(8,14,22,0.85)';
  ctx.beginPath(); ctx.roundRect(tx + 8, ty + th / 2 - 16, tw - 16, 32, 6); ctx.fill();
  ctx.fillStyle = '#7fd4ff';
  ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(String(spdKt), tx + tw / 2, ty + th / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('KT', tx + tw / 2, ty + th / 2 + 20);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('AIRSPEED', tx + 4, ty - 8);

  // --- Altitude tape (right) ---
  const ax = W - tx - tw;
  panel(ctx, ax, ty, tw, th);
  ctx.save();
  ctx.beginPath(); ctx.rect(ax, ty, tw, th); ctx.clip();
  for (let v = altFt - 600; v <= altFt + 600; v += 100) {
    if (v < 0) continue;
    const y = ty + th / 2 - (v - altFt) * 0.14;
    if (y < ty + 4 || y > ty + th - 4) continue;
    const major = v % 500 === 0;
    ctx.strokeStyle = major ? '#fff' : 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.moveTo(ax + 14, y); ctx.lineTo(ax + (major ? 6 : 10), y); ctx.stroke();
    if (major) {
      ctx.fillStyle = '#fff'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(String(v), ax + 18, y);
    }
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(8,14,22,0.85)';
  ctx.beginPath(); ctx.roundRect(ax + 8, ty + th / 2 - 16, tw - 16, 32, 6); ctx.fill();
  ctx.fillStyle = '#7fd4ff';
  ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(String(altFt), ax + tw / 2, ty + th / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('FT', ax + tw / 2, ty + th / 2 + 20);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('ALTITUDE', ax + 4, ty - 8);
  // AGL readout under the tape.
  ctx.fillStyle = aglFt < 150 ? '#ffb84d' : 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`AGL ${aglFt} ft`, ax + tw / 2, ty + th + 18);

  // --- Attitude indicator (bottom centre) ---
  const aiR = 46, aiX = W / 2, aiY = H - 66;
  ctx.save();
  ctx.beginPath(); ctx.arc(aiX, aiY, aiR, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#3f7fd0';
  ctx.fillRect(aiX - aiR, aiY - aiR, aiR * 2, aiR * 2);
  ctx.save();
  ctx.translate(aiX, aiY);
  ctx.rotate(-p.roll);
  const pitchPx = clamp(p.pitch * 90, -aiR, aiR);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-aiR, pitchPx, aiR * 2, aiR * 2);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-aiR, pitchPx); ctx.lineTo(aiR, pitchPx); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(aiX - 22, aiY); ctx.lineTo(aiX - 6, aiY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(aiX + 6, aiY); ctx.lineTo(aiX + 22, aiY); ctx.stroke();
  ctx.beginPath(); ctx.arc(aiX, aiY, aiR, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText('ATTITUDE', aiX, aiY + aiR + 11);

  // --- Throttle / fuel / damage (bottom left) ---
  const bx = 14, by = H - 96;
  panel(ctx, bx, by, 210, 82);
  ctx.textAlign = 'left';
  bar(ctx, bx + 12, by + 14, 186, 10, p.throttle, '#ffd24d', 'THR');
  bar(ctx, bx + 12, by + 38, 186, 10, p.fuel / 100, p.fuel < 25 ? '#ff5a4d' : '#5fd68a', 'FUEL');
  bar(ctx, bx + 12, by + 62, 186, 10, 1 - p.damage / 100, p.damage > 60 ? '#ff5a4d' : '#7fb7ff', 'HULL');
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(`${Math.round(p.throttle * 100)}%`, bx + 196, by + 19);
  ctx.fillText(`${Math.round(p.fuel)}`, bx + 196, by + 43);
  ctx.fillText(`${100 - Math.round(p.damage)}%`, bx + 196, by + 67);

  // --- Vertical speed (bottom right) ---
  const vs = Math.round(feet(G.plane.vspeed) * 60);
  const vx = W - 224, vy = H - 96;
  panel(ctx, vx, vy, 210, 82);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('VERTICAL SPEED', vx + 12, vy + 18);
  ctx.fillStyle = vs > 0 ? '#8fe3a8' : vs < -600 ? '#ff8a7a' : '#fff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`${vs >= 0 ? '+' : ''}${vs} fpm`, vx + 12, vy + 46);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(p.onGround ? 'ON GROUND' : p.speed < 34 ? 'SLOW — ADD POWER' : 'IN FLIGHT', vx + 12, vy + 68);

  // --- Mission panel (top left) ---
  const mx = 14, my = 14;
  const ringsLeft = m.rings.filter((r) => !r.passed).length;
  panel(ctx, mx, my, 250, 96);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`SORTIE ${m.id} — ${m.name.toUpperCase()}`, mx + 12, my + 20);
  ctx.fillStyle = '#fff'; ctx.font = '13px system-ui, sans-serif';
  const next = m.rings.find((r) => !r.passed);
  ctx.fillText(next ? `Next ring: ${ringsLeft} left` : 'All rings clear — land!', mx + 12, my + 42);
  ctx.fillStyle = '#7fd4ff'; ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`SCORE ${G.score}`, mx + 12, my + 64);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '12px system-ui, sans-serif';
  const mm = Math.floor(G.missionTime / 60), ss = String(Math.floor(G.missionTime % 60)).padStart(2, '0');
  ctx.fillText(`TIME ${mm}:${ss}   PAR ${Math.floor(m.par / 60)}:${String(m.par % 60).padStart(2, '0')}`, mx + 12, my + 84);

  // --- Centre reticle ---
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(W / 2, H * 0.54, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2 - 16, H * 0.54); ctx.lineTo(W / 2 - 6, H * 0.54); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2 + 6, H * 0.54); ctx.lineTo(W / 2 + 16, H * 0.54); ctx.stroke();

  // --- Warnings ---
  const warns = [];
  if (G.events.stalled) warns.push(['STALL — NOSE DOWN, FULL POWER', '#ff5a4d']);
  if (aglFt < 90 && !p.onGround && p.vspeed < -4) warns.push(['TERRAIN — PULL UP', '#ff5a4d']);
  if (p.fuel < 25 && p.fuel > 0) warns.push(['LOW FUEL', '#ffb84d']);
  if (p.fuel <= 0) warns.push(['FUEL EMPTY — GLIDE TO THE STRIP', '#ff5a4d']);
  if (G.events.edge) warns.push(['TURN BACK — EDGE OF THE VALLEY', '#ffb84d']);
  if (warns.length) {
    const blink = Math.sin(G.time * 8) > -0.2;
    if (blink) {
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      warns.forEach(([text, col], i) => {
        const y = H * 0.30 + i * 28;
        ctx.fillStyle = col;
        ctx.fillText(text, W / 2, y);
      });
    }
  }
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x, y, Math.max(2, w * clamp(frac, 0, 1)), h, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 3, y + h / 2 + 0.5);
}
