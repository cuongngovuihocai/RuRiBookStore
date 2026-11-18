# Security Specification — Tủ Sách Thanh Âm

## 1. Data Invariants
1. **Public Read / Admin-Only Write**: Public listeners (`/` route, unauthenticated) may read only stories with `isPublished == true` and categories with `isPublic == true`. Only verified admin users (`email_verified == true` and bootstrapped admin email or `/admins/{uid}` document) may create, update, or delete stories and categories.
2. **Strict Schema & No Ghost Fields**: All story and category documents enforce `keys().hasAll(...)` and `keys().hasOnly(...)` on create, and `affectedKeys().hasOnly(...)` on update.
3. **Immutable Ownership & Timestamps**: `createdAt` and `createdBy` must equal `request.time` and `request.auth.uid` on create and cannot change on update; `updatedAt` must equal `request.time`.
4. **Bounded Strings & Arrays**: All strings have explicit `.size()` bounds; `keywords` <= 20 items; `chapters` between 1 and 200 items; document IDs must match `^[a-zA-Z0-9_\-]+$` (<= 128 chars).

## 2. Dirty Dozen Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. Unauthenticated `create` on `/stories/story-1`.
2. Authenticated non-admin user `create` on `/stories/story-1`.
3. Unverified email admin token (`email_verified: false`) attempting `create` on `/stories/story-1`.
4. Shadow/ghost field injection (`isFeatured: true`) in `/stories/story-1` create or update.
5. Oversized `title` (> 200 chars) or empty `title` (`""`) on `/stories/story-1`.
6. Empty `chapters: []` or > 200 chapters in `/stories/story-1`.
7. Spoofed `createdBy` UID not matching `request.auth.uid`.
8. Client-spoofed `createdAt` timestamp not equal to `request.time`.
9. Update attempting to mutate immutable `createdAt` or `createdBy`.
10. Poisoned document ID (`story/../../bad` or > 128 chars).
11. Unauthenticated `get` or `list` of unpublished draft story (`isPublished: false`).
12. Non-admin `create` or `delete` on `/admins/{uid}` or `/categories/{id}`.
