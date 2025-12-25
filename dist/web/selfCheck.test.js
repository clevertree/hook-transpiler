import { test } from 'node:test';
import assert from 'node:assert';
import { runSelfCheck } from './index.js';
test('Transpiler self-check', async () => {
    const result = await runSelfCheck();
    console.log('Self-check result:', result);
    assert.strictEqual(result.ok, true, `Self-check failed: ${result.error}`);
    assert.ok(result.version, 'Version should be present');
});
//# sourceMappingURL=selfCheck.test.js.map