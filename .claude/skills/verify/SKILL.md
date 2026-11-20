---
name: verify
description: Run the game headless + in a real browser and save phase evidence. Use before tagging a phase, after changing rules in src/sim, or when asked for proof/evidence.
---

# Verify a phase and save evidence

1. `npm test` — must be green. If red, fix code (not expectations) unless a ticket changed the rule; then update the scenario and log the reason in `docs/notes/phase-N.md`.
2. For each new requirement in the ticket, make sure a scenario exists in `tests/scenarios/NN_name.json`:
   `{name, requirement, seed, ticks, snapshot_every, scenario, inputs, expect[]}`
   expect items: `{event, tick?, data?}`, `{no_event}`, `{event_count, equals}`, `{end:{...}}`, `{at, path, equals|gt|lt}`.
   Compute expected numbers by hand from `game.contract.json` tuning; write the arithmetic in `requirement`.
3. `npm run proof -- phase-N` → writes `docs/proof/phase-N/README.md` (requirement table, determinism, bot playthrough, screenshots) plus `scenarios.json`, `npm-test.txt`, `screens/`.
   Screenshots need Chrome/Edge (`BROWSER=/path` to override). On Windows run it from PowerShell, not the sandboxed bash.
4. Open the generated README and look at the screenshots yourself; do not claim a visual requirement from the table alone.
5. Update the evaluation section of `docs/notes/phase-N.md` (pass / not yet / why). Report "not passed" honestly.
