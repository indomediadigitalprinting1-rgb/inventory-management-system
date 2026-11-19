# Security Specification & Payload-First TDD (`security_spec.md`)

## 1. Data Invariants
1. **Single Owner Initialization**: `/system/config` can only be created once when no config document exists (`!exists(/databases/$(database)/documents/system/config)`), preventing hostile Owner takeover.
2. **Maximum One Admin Guarantee**: At most one user or invite may hold `role == "ADMIN"` at any time, enforced atomically via `/system/adminSlot` + `getAfter()` checks in `firestore.rules`.
3. **No Self-Privilege Escalation**: A newly signed-in user creating `/users/{uid}` cannot assign themselves `OWNER` (unless `/system/config` does not yet exist or matches bootstrapped Owner email) or `ADMIN` (unless matched by an active `/userInvites/{inviteId}` provisioned by the Owner).
4. **No Negative Stock**: `/items/{itemId}` `currentStock` must always be `>= 0`.
5. **Immutable Confirmed Incoming Transactions**: Once `/incomingTransactions/{txId}` reaches `status == "CONFIRMED"`, items, quantities, prices, and totals cannot be edited; corrections require creating a separate reversal record.
6. **Permanent Item History Guard**: `/items/{itemId}` cannot be deleted (`allow delete: if false` when `hasTransactions == true`).
7. **Immutable Stock Ledger & Audit Logs**: `/stockLedgers`, `/deliveries`, `/stockAdjustments`, and `/auditLogs` forbid all `update` and `delete` operations.
8. **Produksi Isolation**: `PRODUKSI` users can only read their own `/stockRequests` and `/deliveries`, cannot read supplier PII, and cannot mutate `/items`, `/incomingTransactions`, `/stockAdjustments`, `/categories`, `/units`, or `/suppliers`.
9. **Server-Side Timestamps**: All `createdAt` and `updatedAt` timestamps must equal `request.time`.
10. **Strict Idempotency**: Sensitive operations must reserve an unused document in `/idempotencyKeys/{key}` (`!exists`).

## 2. The "Dirty Dozen" Attack Payloads (All Must Return `PERMISSION_DENIED`)
1. **Self-Role Escalation**: Produksi creates `/users/u2` with `role: "OWNER"` -> DENIED.
2. **Shadow Field Injection**: Admin creates `/items/i1` with extra ghost field `isVerifiedBySystem: true` -> DENIED (`hasOnly` check).
3. **Second Admin Creation**: Owner creates `/userInvites/adm2` with `role: "ADMIN"` while `/system/adminSlot` is already `occupied: true` with another admin -> DENIED.
4. **Email Spoofing**: Unverified token (`email_verified: false`) claims bootstrapped Owner email -> DENIED.
5. **Negative Stock Write**: Admin updates `/items/i1` with `currentStock: -5` -> DENIED.
6. **Produksi Direct Stock Mutation**: Produksi sends `update` to `/items/i1` modifying `currentStock` -> DENIED.
7. **Confirmed Incoming Tampering**: Admin edits `totalAmount` on an existing `/incomingTransactions/tx1` with `status: "CONFIRMED"` -> DENIED.
8. **Item Deletion With History**: Owner sends `delete` to `/items/i1` where `hasTransactions == true` -> DENIED.
9. **Ledger History Erasure**: Owner sends `delete` to `/stockLedgers/led1` -> DENIED.
10. **Cross-User Request Scraping**: Produksi A queries `list` on `/stockRequests` without `where('requesterUid', '==', uidA)` -> DENIED.
11. **Path ID Poisoning**: Attacker writes `/items/${"a".repeat(200)}` or `/items/bad$id` -> DENIED (`isValidId`).
12. **Client Timestamp Forgery**: Authenticated Admin writes `/stockLedgers/led2` with backdated `createdAt: "2020-01-01"` instead of `request.time` -> DENIED.
