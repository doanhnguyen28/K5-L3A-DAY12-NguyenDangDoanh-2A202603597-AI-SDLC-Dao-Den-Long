# AGENTS.md — Đảo Đèn Lồng

3D third-person game (Three.js in browser) + headless simulation (Node) graded by Test Contract v1.0.

## Commands
- Install: `npm install` (only dependency: three@0.160.0)
- Play: `npm start` → http://localhost:8080 (`?autostart=1&seed=N&bot=1&warp=T` for scripted views)
- Test (unit + contract + scenarios): `npm test`
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f] [--snapshot-every N]`
- Evidence: `npm run proof -- phase-N` → `docs/proof/phase-N/` (skill: `.claude/skills/verify/SKILL.md`)

## Layout
- `src/sim/` pure deterministic game logic, no DOM, no `Math.random`, no `Date`. Shared by headless and web.
- `src/headless.js` CLI per contract. `src/web/` rendering/input/audio only — never changes rules.
- `game.contract.json` is the single source of tuning numbers; sim reads it. Never hard-code tuning elsewhere.
- `tests/scenarios/*.json` = requirement → scenario → expectations (run through the real CLI).
- `docs/notes/` assumptions, AI log, retro. `docs/lab/` original lab brief (read-only).

## Rules
- Contract text on the lab board is the authority. Quote it; do not invent requirements. Unclear → write an assumption in `docs/notes/phase-N.md`.
- Tick model: snapshot tick 0 = after setup; step k reads input k, events get tick k+1. Timers use absolute tick stamps.
- Every new rule gets a scenario in `tests/scenarios/` with hand-computed expected values (never copy them from program output).
- Creative extras must be render-only (src/web) so headless output is unchanged.
- Changing an old test because a ticket replaced a rule: edit it and record the reason in `docs/notes/phase-N.md`. Never delete or skip silently.
- No code comments unless asked. Keep files small; no new dependencies without a reason in notes.
- Do not finish while `npm test` is red (Stop hook enforces this).
