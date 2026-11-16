# Security Specification & Hardened Audit — Croce Oro Massa Carrara Cloud Sync

## 1. Data Invariants
1. **Fail-Closed Root**: Every unmapped collection/document path is denied by default (`match /{document=**} { allow read, write: if false; }`).
2. **Shard Containment**: Live synchronized state is strictly confined to allowlisted `sync_shards` document IDs (`mission`, `volontari`, `servizi`, `turni`, `bacheca`, `magazzino`, `timbrature`, `indirizzi`, `checklists`, `config`). No client can list `/sync_shards` or inject arbitrary document IDs.
3. **Verified Identity**: All reads/writes require Firebase Auth (`request.auth != null`) AND verified email (`request.auth.token.email_verified == true`), AND verified Admin (`270bis@live.it` or `/admins/{uid}`) or active approved `/operators/{uid}`.
4. **Immutable Temporal & Identity Anchors**: `createdAt` must equal `request.time` on create and remain identical on update. `updatedAt` must equal `request.time` on both create and update. `updatedByUid` must equal `request.auth.uid`.
5. **Privilege Escalation Prevention**: Non-admin verified users can only submit a `pending` request in `/operator_requests/{request.auth.uid}`. Only `isAdmin()` can create or mutate `/operators/{uid}` or `/admins/{uid}`, or approve/reject requests.
6. **PII Isolation**: `/operator_requests/{requestUid}` and `/operators/{operatorUid}` reads and queries are isolated strictly to the document owner (`uid == request.auth.uid`) or Admin. No blanket reads exist.
7. **Token-Gated Zero-PII PIN Reset Tickets**: `/pin_resets/{tokenId}` contains zero PII (no email, phone, tax ID, or address), strictly forbids collection listing (`allow list: if false;`), enforces `^rst-[a-zA-Z0-9_\-]{8,92}$`, allows unauthenticated single-document update ONLY when `existing().status == 'pending'`, `incoming().status == 'completed'`, `incoming().pinProvvisorioVerifica == existing().pinProvvisorio`, and `nuovoPin` is a valid non-reserved 4-digit PIN different from the provisional PIN.
8. **Zero-PII Write-Only Profile Reset Index**: `/pin_reset_profiles/{volunteerId}` stores only domain-prefixed SHA-256 digests (`emailHash`, `pinHash`) and denies both `get` and `list` to unauthenticated callers (blocking hash scraping and offline dictionary attacks). Unauthenticated `update` is permitted ONLY when `existing().status in ['ready', 'pending', 'applied']`, `incoming().status == 'completed'`, `incoming().verifyingProofHash` equals `existing().emailHash` or `existing().pinHash`, and `nuovoPin` is a valid non-reserved 4-digit PIN.

## 2. The "Dirty Dozen" Payloads (Expected Result: PERMISSION_DENIED)
1. **Unauthenticated Shard Read**: Anonymous caller tries `GET /sync_shards/volontari` -> Denied (`isVerifiedUser()` false).
2. **Unverified Email Admin Spoof**: Caller has `email: "270bis@live.it"` with `email_verified: false` -> Denied (`isVerifiedUser()` false).
3. **Shadow Field Injection on SyncShard Create**: Authorized operator sends `extraAdminFlag: true` on `CREATE /sync_shards/mission` -> Denied (`data.keys().hasOnly(...)`).
4. **Arbitrary Shard ID Poisoning**: Authorized operator creates `/sync_shards/malicious_shard` -> Denied (`isAllowedShardId(shardId)` false).
5. **Path ID Poisoning (>128 chars / invalid chars)**: Caller targets `/sync_shards/../../etc/passwd` -> Denied (`isValidId` false).
6. **Identity Spoofing on SyncShard Write**: Operator sends `updatedByUid: "other-uid"` -> Denied (`data.updatedByUid == request.auth.uid` false).
7. **Timestamp Backdating**: Operator sends custom client timestamp `updatedAt: "2020-01-01T00:00:00Z"` -> Denied (`data.updatedAt == request.time` false).
8. **Self-Assigned Admin**: Non-admin user tries `CREATE /admins/{ownUid}` -> Denied (`isAdmin()` false).
9. **Self-Approved Operator Request**: Pending user tries `UPDATE /operator_requests/{ownUid}` changing `status: "approved"` -> Denied (Terminal/Admin gate).
10. **Collection Scraping List Query**: Caller tries `LIST /sync_shards`, `LIST /admins`, `LIST /pin_resets`, or unauthenticated `LIST /pin_reset_profiles` -> Denied.
11. **Oversized DisplayName Resource Exhaustion**: User sends 5KB `displayName` in `/operator_requests/{uid}` -> Denied (`displayName.size() <= 120`).
12. **Stale/Downgraded Version Write by Operator**: Operator tries `UPDATE /sync_shards/mission` with `version <= existing().version` -> Denied (`incoming().version > existing().version`).
13. **PIN Reset Wrong Provisional Verification**: Unauthenticated caller tries `UPDATE /pin_resets/rst-valid12345` with wrong `pinProvvisorioVerifica` -> Denied (`incoming().pinProvvisorioVerifica == existing().pinProvvisorio` false).
14. **PIN Reset Terminal Replay / Reserved PIN**: Caller tries `UPDATE /pin_resets/rst-valid12345` after `status == 'completed'` or setting `nuovoPin: '4451'` -> Denied (`existing().status == 'pending'` / `!= '4451'`).
15. **Unauthenticated Read of Profile Hash Index**: Anonymous caller tries `GET /pin_reset_profiles/vol-ricci` -> Denied (`isOperator()` false).
16. **PIN Reset Profile Wrong Proof Hash / Hash Tampering**: Unauthenticated caller tries `UPDATE /pin_reset_profiles/vol-ricci` with mismatched `verifyingProofHash` or modified `emailHash` -> Denied.
