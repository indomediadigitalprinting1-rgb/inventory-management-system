import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('firestore.rules enforces global deny, blueprint collection coverage, and Dirty Dozen invariants', () => {
  const rules = fs.readFileSync(rulesPath, 'utf-8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8')) as {
    firestore: Record<string, unknown>;
  };

  // Global catch-all safety net
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);

  // Email verification required against spoofing
  assert.match(rules, /request\.auth\.token\.email_verified == true/);

  // Path ID poisoning guard
  assert.match(rules, /function isValidId\(id\)/);

  // Negative stock guard
  assert.match(rules, /data\.currentStock is number && data\.currentStock >= 0/);

  // Prevent deletion of items with transaction history
  assert.match(rules, /existing\(\)\.hasTransactions == false/);

  // Max 1 Admin atomic lock
  assert.match(rules, /\/system\/adminSlot/);
  assert.match(rules, /getAfter\(\/databases\/\$\(database\)\/documents\/system\/adminSlot\)/);

  // Immutable ledgers, deliveries, adjustments, audit logs
  assert.match(rules, /match \/stockLedgers\/\{ledgerId\}/);
  assert.match(rules, /match \/auditLogs\/\{logId\}/);
  assert.match(rules, /match \/deliveries\/\{deliveryId\}/);
  assert.match(rules, /match \/stockAdjustments\/\{adjId\}/);

  // Ensure every top-level collection in blueprint is matched in firestore.rules
  const collections = Object.keys(blueprint.firestore).map((p) => p.split('/')[1]);
  for (const col of new Set(collections)) {
    assert.ok(
      rules.includes(`match /${col}/`),
      `Missing match block in firestore.rules for collection /${col}`
    );
  }
});
