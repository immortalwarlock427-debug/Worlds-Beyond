# Supabase setup: private character cloud saves

This phase adds **manual cloud copies** for player-owned characters, not online sessions. The site now includes its public Supabase URL/key in `js/cloud-config.js`, so players only need to sign in.
The existing character sheet, JSON import/export, DM room and same-browser player preview remain local-first.

## Setup (required to activate cloud storage)

1. Create a Supabase project at https://supabase.com/dashboard and enable Email Auth.
2. For a new isolated test project, apply both files in `supabase/migrations/` in timestamp order. They create `public.wb_characters`, enforce owner-only Row Level Security (RLS), and limit document size. For the existing production project, use the GitHub deployment workflow below instead of rerunning SQL manually. **Do not enable cloud writes before the policies are installed and tested.**
3. In **Project Settings → API Keys**, copy the **publishable** key (`sb_publishable_...`; older projects may have a public `anon` key), **never** a secret key, service_role key or private server credential.
4. Copy the project HTTPS URL (for example `https://your-project.supabase.co`).
5. For the live Worlds Beyond GitHub Pages site, the project URL and publishable key are already configured in `js/cloud-config.js`. Players open **Cloud Saves** and sign in; they do **not** paste configuration values. The Supabase browser client downloads from the CDN at pinned version 2.118.0, with a SHA-384 integrity hash checked against the npm package; a content blocker might need to allow it. The owner can expand **Advanced: change cloud connection** to temporarily test another Supabase project, or choose **Use Worlds Beyond default** to reset.
6. Sign up with an email and password. Depending on Auth settings, verify the email before signing in. In **Authentication → URL Configuration**, set Site URL and allowed Redirect URLs to your deployed domain / Cloud Saves route so confirmation links return to the app. Temporary Netlify Deploy Preview domains must be added if testing confirmation there.
7. Create or save a character in **Character Sheet** on the **same browser/site origin**, then return to Cloud Saves and press **Save local character to cloud**.
8. On another device, open the same Worlds Beyond deployment, sign in to the same account and use **Restore to this device**. This replaces only the local character on that device; reopen/refresh the sheet afterward.

## Safety and behavior

- **Manual saves:** No automatic upload, background sync or collaborative editing. Check **Cloud Saves** whenever you want to transfer a character. A local Save is not a Cloud Save.
- **Multiple characters:** The cloud account can hold several character copies. Each row has its own ID and revision; using **Restore** swaps the current local character.
- **Conflict checks:** Saving an existing cloud character requires the revision this local character copy last saved or restored, scoped to the project and account. If another device saved a new revision, the conditional update finds no match and returns a conflict instead of silently overwriting. Refreshing the list does not change the local revision. Export local edits first, restore the newer copy, then reapply the edits you want to keep. Legacy copies without a receipt must also export/restore before overwriting an existing cloud row.
- **Open tabs:** restore pauses autosave in older Character Sheet tabs. Export any unsaved edits from those tabs before selecting Reload saved character. If local data changes during a cloud request, the cloud page does not overwrite it. This is a guard for current clients, not a transactional collaboration system.
- **Backups:** Click **Download local backup** (a v1 JSON character export) before restoring. The Cloud Saves screen also keeps the immediately previous local character in a small undo backup on this browser.
- **Large portraits:** The manual cloud upload currently limits UTF-8 serialized character documents to 3,000,000 bytes. The additional `20261031002000_character_document_size.sql` migration enforces a 3,000,000-byte limit on PostgreSQL’s JSONB text representation for new inserts/updates. PostgreSQL formatting adds some bytes, so a near-limit upload can still be refused by the server. The NOT VALID constraint preserves existing oversized copies for export/reduction; validate it separately after checking existing rows. Export locally before trimming large embedded images; object storage is a later feature.
- **RLS:** Browser publishable keys do NOT secure private data by themselves. The SQL policy uses `auth.uid()` so account A cannot read/write account B's characters. Never use the service_role key in client code. The client does not have permission to sync DM encounters.
- **Manual verification:** Test with **two different Supabase Auth users**. User B should not see, retrieve, overwrite or delete A's character. Confirm a stale revision cannot overwrite another browser's save, and that local JSON exports and DM encounters stay intact.
- **Domain separation:** Browsers store local characters by origin. Preview and production are different origins, so their local saves do not automatically appear across those URLs. The cloud account is independent of origin when it uses the same Supabase project.
- **Authentication and invitations:** For a private tabletop group, disable public sign-ups in Supabase Auth after inviting/creating the allowed player accounts. Set up proper SMTP delivery for email confirmations and account recovery before wider use. The public site can still be visited by anyone, but RLS grants character access only after sign-in. Don't publish or bundle secret/service-role keys.

## Next phase: online sessions

A real multiplayer session will need server-enforced game ownership/membership, join codes, an action log, authenticated/revisioned combat RPC, redacted player views, and real-time subscriptions. **Do not** share the existing full DM game document with players: it contains hidden enemy mechanics and fog.

Reference: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/reference/javascript/installing

## GitHub production deployment

With the Supabase GitHub integration connected to `main`, `supabase/config.toml` binds `[remotes.main]` to the existing production Supabase project and enables migrations. The SQL migration uses a full 14-digit UTC timestamp as required by the Supabase CLI. On merging a new Supabase-file commit to `main`, review **Supabase → Branches → main → View Logs**, then confirm `public.wb_characters` exists and RLS is enabled. Apply future migrations through that same deployment workflow; test the new size constraint in an isolated project first. Do not also run the migration manually in SQL Editor: mixing deployment and manual schema changes can cause migration-history drift.

## Browser configuration for players

The live GitHub Pages site automatically uses `js/cloud-config.js` (project URL and `sb_publishable_...` key), so players never paste these. This key is intentionally public and is safe only because `wb_characters` uses owner-only RLS. To change projects permanently, update this file in the repository, test on a pull-request preview and deploy. To test another project temporarily, expand Advanced in the Cloud Saves page and use the override; select **Use Worlds Beyond default** to clear it. Existing signed-in sessions use their browser's stored Supabase Auth session. Cloud Save and Restore remain manual, not automatic syncing.
