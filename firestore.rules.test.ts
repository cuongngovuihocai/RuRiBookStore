// Security Rules Verification Specification for Tủ Sách Thanh Âm
// Verifies the 12 adversarial payloads against firestore.rules:
// 1. Unauthenticated write -> DENIED
// 2. Non-admin authenticated write -> DENIED
// 3. Unverified email admin spoof -> DENIED
// 4. Ghost field injection -> DENIED (hasOnly check)
// 5. Invalid/oversized title -> DENIED
// 6. Empty chapters array -> DENIED
// 7. Spoofed createdBy -> DENIED
// 8. Client-provided createdAt != request.time -> DENIED
// 9. Mutating createdAt/createdBy on update -> DENIED
// 10. Poisoned document ID -> DENIED (isValidId)
// 11. Public read of isPublished == false -> DENIED
// 12. Escalating privilege via /admins write -> DENIED

export const DIRTY_DOZEN_CASES = [
  'unauthenticated_story_create',
  'non_admin_story_create',
  'unverified_email_admin_spoof',
  'shadow_ghost_field_injection',
  'oversized_or_empty_title',
  'empty_chapters_array',
  'spoofed_created_by_uid',
  'client_spoofed_timestamp',
  'immutable_field_mutation',
  'poisoned_document_id',
  'unpublished_story_public_read',
  'admin_collection_privilege_escalation',
] as const;
