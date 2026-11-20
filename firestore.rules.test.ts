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

  // Max 1 Admin atomic lock + invited Admin slot claiming + deactivation release
  assert.match(rules, /\/system\/adminSlot/);
  assert.match(rules, /getAfter\(\/databases\/\$\(database\)\/documents\/system\/adminSlot\)/);
  assert.match(rules, /function hasActiveAdminInvite\(\)/);
  assert.match(rules, /hasActiveAdminInvite\(\)[\s\S]*affectedKeys\(\)\.hasOnly\(\['adminUid', 'updatedAt'\]\)/);
  assert.match(rules, /incoming\(\)\.role != 'ADMIN' \|\|[\s\S]*incoming\(\)\.active == false/);

  // Immutable ledgers, deliveries, adjustments, audit logs
  assert.match(rules, /match \/stockLedgers\/\{ledgerId\}/);
  assert.match(rules, /match \/auditLogs\/\{logId\}/);
  assert.match(rules, /match \/deliveries\/\{deliveryId\}/);
  assert.match(rules, /match \/stockAdjustments\/\{adjId\}/);

  // Notifications support readAtBy timestamp tracking and scoped deletion
  assert.match(rules, /match \/notifications\/\{notifId\}[\s\S]*readAtBy[\s\S]*allow delete:/);

  // Only Owner can delete non-owner users (never self or another OWNER) and invites
  assert.match(rules, /match \/users\/\{userId\}[\s\S]*allow delete: if isOwner\(\)[\s\S]*userId != request\.auth\.uid[\s\S]*existing\(\)\.role != 'OWNER'/);
  assert.match(rules, /match \/userInvites\/\{inviteId\}[\s\S]*allow delete: if isOwner\(\)/);
  assert.ok(!rules.includes('isStaffPasswordAccount'), 'Username+password bypass should be removed');
  assert.ok(!rules.includes('match /usernames/'), '/usernames collection should be removed');

  // Ensure every top-level collection in blueprint is matched in firestore.rules
  const collections = Object.keys(blueprint.firestore).map((p) => p.split('/')[1]);
  for (const col of new Set(collections)) {
    assert.ok(
      rules.includes(`match /${col}/`),
      `Missing match block in firestore.rules for collection /${col}`
    );
  }
});
