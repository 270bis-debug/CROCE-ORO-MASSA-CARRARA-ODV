/**
 * Dirty Dozen Security Test Suite Reference for Croce Oro Cloud Firestore Rules
 * Validates that every adversarial payload violates at least one explicit Firestore rule invariant.
 */

export const DIRTY_DOZEN_PAYLOADS = [
  {
    name: '01_unauthenticated_shard_read',
    path: '/sync_shards/volontari',
    operation: 'get',
    auth: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '02_unverified_admin_email_spoof',
    path: '/sync_shards/mission',
    operation: 'get',
    auth: { uid: 'spoof1', token: { email: '270bis@live.it', email_verified: false } },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '03_shadow_field_injection_on_shard',
    path: '/sync_shards/mission',
    operation: 'create',
    payload: {
      shardId: 'mission',
      version: 1,
      payload: {},
      updatedByUid: 'op1',
      updatedByEmail: 'op@croceoro.org',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
      ghostPrivilege: true
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '04_unlisted_shard_id_injection',
    path: '/sync_shards/rogue_shard',
    operation: 'create',
    payload: { shardId: 'rogue_shard', version: 1, payload: {} },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '05_path_id_poisoning_length',
    path: `/sync_shards/${'a'.repeat(200)}`,
    operation: 'get',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '06_updatedByUid_spoofing',
    path: '/sync_shards/turni',
    operation: 'create',
    auth: { uid: 'real-op-uid', token: { email: 'op@croceoro.org', email_verified: true } },
    payload: {
      shardId: 'turni',
      version: 1,
      payload: {},
      updatedByUid: 'victim-uid',
      updatedByEmail: 'op@croceoro.org'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '07_client_forged_timestamp',
    path: '/sync_shards/turni',
    operation: 'create',
    payload: { createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '08_self_assigned_admin_creation',
    path: '/admins/attacker_uid',
    operation: 'create',
    auth: { uid: 'attacker_uid', token: { email: 'attacker@example.com', email_verified: true } },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '09_self_approved_operator_request',
    path: '/operator_requests/attacker_uid',
    operation: 'update',
    auth: { uid: 'attacker_uid', token: { email: 'attacker@example.com', email_verified: true } },
    payload: { status: 'approved' },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '10_collection_list_scraping_shards',
    path: '/sync_shards',
    operation: 'list',
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '11_oversized_displayName_poisoning',
    path: '/operator_requests/op_uid',
    operation: 'create',
    payload: { displayName: 'X'.repeat(5000) },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '12_non_monotonic_version_downgrade',
    path: '/sync_shards/mission',
    operation: 'update',
    existingVersion: 5,
    payload: { version: 4 },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '13_pin_resets_collection_list_scraping',
    path: '/pin_resets',
    operation: 'list',
    auth: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '14_pin_reset_invalid_token_prefix',
    path: '/pin_resets/arbitrary_doc',
    operation: 'get',
    auth: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '15_pin_reset_wrong_provisional_pin_or_reserved_pin',
    path: '/pin_resets/rst-validtoken1234',
    operation: 'update',
    auth: null,
    payload: {
      status: 'completed',
      pinProvvisorioVerifica: '9999',
      nuovoPin: '4451'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '16_pin_reset_terminal_replay_after_completed',
    path: '/pin_resets/rst-validtoken1234',
    operation: 'update',
    auth: null,
    existingStatus: 'completed',
    payload: {
      status: 'completed',
      pinProvvisorioVerifica: '1234',
      nuovoPin: '5678'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '17_pin_reset_profile_unauthenticated_read',
    path: '/pin_reset_profiles/vol-ricci',
    operation: 'get',
    auth: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '18_pin_reset_profile_wrong_proof_hash',
    path: '/pin_reset_profiles/vol-ricci',
    operation: 'update',
    auth: null,
    payload: {
      status: 'completed',
      verifyingProofHash: '0'.repeat(64),
      nuovoPin: '5678'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '19_shift_signups_collection_list_scraping',
    path: '/shift_signups',
    operation: 'list',
    auth: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '20_shift_signups_status_applied_spoof',
    path: '/shift_signups/cand-123456',
    operation: 'create',
    auth: null,
    payload: {
      signupId: 'cand-123456',
      status: 'applied'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '21_public_roster_unauthenticated_write',
    path: '/public_roster/volunteers_v1',
    operation: 'update',
    auth: null,
    payload: {
      rosterId: 'volunteers_v1',
      version: 2,
      entries: [],
      deletedIds: []
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '22_public_roster_collection_list_scraping',
    path: '/public_roster',
    operation: 'list',
    auth: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    name: '23_public_roster_arbitrary_doc_id',
    path: '/public_roster/admin_dump',
    operation: 'get',
    auth: null,
    expected: 'PERMISSION_DENIED'
  }
];
