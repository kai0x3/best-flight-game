# Ridgeline Courier — a bush-plane flight game

[![Best Flight Game](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/kai0x3/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/kai0x3/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

An original bush-plane flight game, built for the [best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057) on make.fun. Fly the mail plane down Ridgeline Valley: thread the marker rings, watch your fuel, mind the ridges — and bring her home on the grass strip in one piece.

## The game

**Ridgeline Courier** is a complete flight game that plays offline in a desktop browser from its own files — no network requests, no libraries, no build step. Open `game/index.html` (or serve `game/` with `node serve.ts` and visit http://localhost:8080).

- **Chase view over recognisable terrain** — a procedural alpine valley with a carved river, pine forests, cabins, two grass airstrips and drifting clouds, rendered by a small software 3D projector in plain canvas 2D.
- **The aircraft in frame, instruments lit** — a red-and-cream courier plane with a spinning prop and blinking nav lights, plus a full HUD: compass tape, airspeed and altitude tapes, attitude indicator, throttle / fuel / hull gauges, vertical speed and a mission panel.
- **A runway or a target ring ahead** — every sortie flies toward glowing marker rings and ends on a lit runway.
- **Three sorties, three kinds of light** — *Valley Run* in clean daylight, *Ridge Crossing* at golden hour over the eastern ridge, and *Dusk Delivery*, a return leg home with the runway lights on and a crosswind on final.
- **Decisions, not just steering** — fuel burns with the throttle and every ring tops the tank up; a stall drops the nose; a hard touchdown bends the airframe; a gentle landing on the target strip earns the landing bonus and a Gold / Silver / Bronze rating.
- **Synthesised sound** — propeller engine, wind and ring chimes, all generated live with WebAudio. No audio files. `M` mutes.

## How to fly

| Control | Action |
|---|---|
| `W` / `S` | Throttle up / down |
| `↑` / `↓` | Pitch up (climb) / down |
| `←` / `→` or `A` / `D` | Bank and turn |
| Mouse drag | Steer |
| `P` / `Esc` | Pause |
| `R` | Restart sortie |
| `M` | Mute |

Take off by holding `W` to full throttle, then pulling `↑` once the speed passes about 65 kt. Fly through each glowing ring (centre passes score extra), then land on the target strip: slow down, wings level, gentle descent. Rings are worth 100 points (150 dead centre), a landing is worth 500 plus a time bonus.

## Files

- `game/` — the playable game (`index.html` + `src/*.js`, ES modules, no dependencies)
- `screenshots/` — four real renders of the game's own code
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `serve.ts` — a tiny static server for local play-testing
- `vendor/makefun-game.ts` — the make.fun dossier library, copied from the kit unchanged

## Screenshots

The four screenshots are staged, deterministic renders of the game (`?shot=cover`, `?shot=rings`, `?shot=landing`, `?shot=complete`) — the same code that plays, frozen mid-flight.

## License

MIT — see [LICENSE](LICENSE).
