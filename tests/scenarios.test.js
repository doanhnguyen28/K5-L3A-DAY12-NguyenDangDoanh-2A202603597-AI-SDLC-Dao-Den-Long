import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkExpectations, listScenarios, runScenarioCli } from './lib/scenario.js';

for (const s of listScenarios()) {
  test(`scenario ${s.name}: ${s.requirement}`, () => {
    const { lines } = runScenarioCli(s);
    const failed = checkExpectations(lines, s.expect).filter((r) => !r.ok);
    assert.deepEqual(failed, [], JSON.stringify(failed, null, 2));
  });
}
