---
name: verify
description: Run the game headless + in a real browser and save phase evidence. Use before tagging a phase, after changing rules in src/sim, or when asked for proof/evidence.
---

# Verify a phase and save evidence

1. `npm test` — must be green. If red, fix code (not expectations) unless a ticket changed the rule; then update the scenario in `tests/gen_scenarios.py` and log old→new + reason in `docs/notes/phase-N.md`.
2. For each new requirement, make sure a scenario exists. Add it to `tests/gen_scenarios.py` with `add(name, requirement, ticks, scenario, inputs, expect, night=1, every=1)`, then regenerate:
   `python tests/gen_scenarios.py tests/scenarios`
   expect items: `{event, tick?, data?}`, `{no_event}`, `{event_count, equals}`, `{end:{...}}`, `{at, path, equals|gt|lt|between|in|ne}` (`path` like `player.pos.1`, `drifters.length`).
   Compute expected numbers by hand from `game.contract.json` + `src/sim/constants.js`; write the arithmetic in `requirement`.
3. Mutation check: change the number the new scenario is about (contract or constants), run `node --test tests/scenarios.test.js`, confirm it fails, restore.
4. `npm run proof -- phase-N` → `docs/proof/phase-N/README.md` (requirement table, determinism per night, bot playthrough per night, full-night timing, screenshots). Screenshots need Chrome/Edge (`BROWSER=/path`); on Windows run from PowerShell, not the sandboxed bash.
5. Open the screenshots yourself. A visual requirement is "verified" only if the image shows it; otherwise mark it "chơi thử tay".
6. Update the evaluation section of `docs/notes/phase-N.md`. Report "chưa đạt" honestly, including what only a human playtest can confirm (audio, settings persistence, FPS on real hardware).
