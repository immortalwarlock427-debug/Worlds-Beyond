# Future architecture: cloud characters, DM screen and multiplayer

**Status:** phase-0 persistence repository and DOM-free game normalizer are now implemented in the corresponding refactor PR. The DM screen, cloud services, accounts, authorization and live sync are not implemented. The existing GitHub Pages character sheet and offline exports remain the supported experience until new pieces are tested.

## Shared combat-rules foundation (phase-1 extraction)
- `js/combat-core.js` now supplies pure functions for scores/modifiers, current gear, AP spending/refunds, and movement planning. The main sheet delegates to these functions instead of maintaining separate formulas. Ability/form effects are supplied explicitly from `WBAbilities`.
- The next shared-rules PR also extracts attacks, damage, defenses, death threshold and Death's Mercy; the encounter action protocol, turn/actor permissions and authoritative action application still remain. Do not ship a DM screen that guesses these values or duplicates their rules. The combat core has no database, permission, or cloud-sync capabilities.

## Guiding rules

1. **One authoritative rules engine.** Extract calculations, item validation, ability activation and form switching from the DOM-heavy `js/app.js` into pure, tested modules that accept a character state and return results/actions. The Sheet, DM view and multiplayer processes must not duplicate their own rules. Keep custom STR/VIT/DEX/AGL/INT/WIS/CHA/FTH and AP mechanics; this is not a generic D&D engine.
2. **Separate ownership.** Character data is player-owned. Encounters, maps, fog, NPCs, and hidden information are session/DM-owned. This separation already exists as distinct localStorage keys, `worlds-beyond-sheet-v1` and `worlds-beyond-game-v1`. Keep it.
3. **Local-first compatibility.** Import/export JSON remains available even after account login exists. Don't discard local character edits when the network drops. Show clear sync states (Local only, Saving, Saved, Conflict, Offline) and never silently overwrite an unsynced character.
4. **Permission checks must be enforced by the backend.** Hiding a button in the client is not authorization. Do not ship secrets, private DM maps or fog to clients that lack permission to see them.

## Phased delivery

| Phase | Goal | Definition of done |
|---|---|---|
| 0. Domain / save boundary | Persistence adapters (`js/persistence.js`) and pure game-state normalizer (`js/game-state.js`) started; reusable combat rules and schema migrations remain | Existing UI still works, tests cover v1/legacy imports and separate character/game saves |
| 1. Offline DM room | DM imports several character JSON files and can create an encounter, initiative order, health and turn tracker | Can run a complete test encounter without accounts, all using shared rules |
| 2. Cloud character accounts | Sign in, save/list/restore multiple characters, sync between phone and laptop | Private characters, ownership enforced, offline export and recovery available |
| 3. Online sessions | DM creates session, gives invite/join code, players join with selected characters | Real-time map, tokens, turns and status updates; reconnect safely |
| 4. Permissions and polish | Per-player privacy, DM role, spectators, replay/action log, assets and mobile UX | Security tests, reconciliation tests, clear connection status |

Phase 2 can start before phase 1 if cross-device saving becomes the immediate priority, but the domain/data separation in phase 0 comes first either way.

## Proposed data entities

- **Account**: `user_id` from authentication. A single account can own multiple characters.
- **Character**: stable `character_id` (existing `state.id`), `owner_id`, `revision`, `updated_at`, `schema_version`, and a private character document. Keep form profiles, abilities, resources and portraits in this player-owned document initially.
- **Game**: `game_id`, `dm_user_id`, metadata and a join/invite mechanism; must be separate from an individual character.
- **Game membership**: `game_id`, `user_id`, `character_id` when playing, `role` (DM / player / spectator), and sharing settings. Validate ownership when joining with a character.
- **Encounter**: `encounter_id`, game reference, map state, enemies, fog, initiative/turn, and the version of current encounter state.
- **Action log** (later): `action_id`, actor, encounter, action type/payload, server sequence and result. This lets clients reconnect without guessing which move or AP expenditure happened.

Don't combine everyone into one giant character JSON, and don't use display names or browser storage keys as cloud identity.

## Cloud storage and authorization

A candidate is Supabase Auth + PostgreSQL + Row Level Security + Realtime; Firebase is another possible backend. The choice is not locked until the first cloud prototype.

- Enable and test database row-level ownership/security policies **before** exposing private records. Users can read and write their own characters; a DM sees only data explicitly granted by a player or by game rules. Being a game member does not grant blanket write access to all members' characters.
- A join code is a convenience, **not** authentication or blanket permission. DM-only actions (initiative advances, hidden creature movements and fog) must be validated server-side.
- Real-time messages are signals, not truth: validate rule-changing actions, permissions, turn order, AP costs, ownership, and revision against authoritative state before broadcasting results. Never trust `spentAp: 0` or client-calculated damage without validation.
- Store portraits and map images in an authenticated file/object store with owner-restricted paths, not indefinitely as giant base64 values in JSON/localStorage. Plan size/format limits for mobile.
- Never put service-role keys or privileged credentials in GitHub Pages JavaScript. Public client SDK keys are only safe when authorization policies are correct.

## Sync and conflicts

- Today `state` is mutable and saved with a 250ms debounce through `WBPersistence` local repositories. Don't directly replace that with constant "upload entire object on every keypress" calls.
- The synchronous `WBPersistence.createLocalRepositories` and `createMemoryRepositories` adapters now exist; a later authenticated cloud implementation will need an **asynchronous** interface and conflict handling. An explicit sync queue can batch changes. Include a `revision`/version token so saving from two devices does not silently overwrite changes.
- For **character editing**, detect conflicting revisions, show which copy is newer and allow the player to choose or merge. Keep local backup/export.
- For **live combat**, send typed commands (e.g. `UseAbility`, `MoveToken`, `EndTurn`, `ApplyDamage`) instead of two clients replacing the same entire session document. Apply them once, in a defined order, to authoritative state.
- Mobile browsers can suspend background tabs and clear storage. Show last cloud-sync timestamp and the distinction between `Saved on this device` and `Synced to cloud`; test interrupted network/reconnect.

## Migrations and testing

- Current exports are `{format: 'worlds-beyond-character', version: 1, state}`; the schema is evolving inside version 1. Before cloud release, introduce deterministic versioned migrations (`migrateCharacter`, `migrateGame`) with fixtures for legacy characters. Preserve unknown but safe custom fields when possible.
- Keep pure rules tests in Node, plus browser smoke tests on Netlify and eventual end-to-end tests against an isolated database project.
- Build tests for two devices modifying one character, permission denials (player tries to edit another character/see DM fog), disconnect during turn action, duplicate action submitted twice, import/export round trips, and characters with many abilities and multiple form profiles.
- Treat game and character as separate collections and avoid automatically merging a DM-owned game record into a character on import.

## Immediate engineering guardrails

Continue independent modules (e.g., `js/abilities.js`, `js/resources.js`, `js/equipment-profiles.js`) instead of adding every new feature to `js/app.js`. For upcoming work, prioritize moving reusable character and combat calculations out of DOM handlers; keep functions deterministic and give them regression tests. No accounts, network endpoints, or external keys should be added merely to prepare the architecture.

Reference documentation:
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Realtime: https://supabase.com/docs/guides/realtime/getting_started
- Firebase Firestore offline persistence: https://firebase.google.com/docs/firestore/manage-data/enable-offline

## First foundation slice delivered

The character sheet now calls the repository interfaces for startup load, debounce save, immediate portrait save, export/import and Clear Character. The browser keys and export v1 remain exactly the same. The former `normalizeGame` logic lives in a standalone module callable by a future DM view. Test coverage includes local-storage errors, old character exports, unknown future versions, and player vs DM state isolation. **This is not cloud sync**: all current users still have device-local browser storage unless they export/import a file.

## Combat resolution phase two

The character sheet delegates natural-20 hit checks, dual-wield hit/damage resolution, crit totals, resistance/Armor Rating/Overwhelming Force ordering, block/dodge/parry and saves, and Death Threshold/Mercy math to `WBCombat`. Rolls are supplied to pure functions; browser/DM rendering only formats the results. This provides **shared calculations**, not authenticated multiplayer: before live sessions, implement verified command handling, replay-safe action IDs, revisions, turn ownership and DM permission checks enforced by the backend.

## Validated encounter command protocol (offline foundation)

`js/encounter-actions.js` implements deterministic `WBEncounter.applyAction` over a DM-owned encounter snapshot. Action IDs, expected revisions, current-turn checks, actor ownership hints, and DM-only mutations are checked before applying commands. AP uses `WBCombat.spendAp`; damage uses `WBCombat.afterArmor` then `WBCombat.damageHealth`. The encounter is optional inside the existing separate game save, preserving older map/foe saves and character exports. Pure tests cover retries, stale updates, bad payloads, action permissions and turn/health rules.

**Important:** The role/user identity is supplied by the caller and is **not authenticated**. The local bounded retry cache is **not** a permanent action log and cannot prevent replay after eviction or synchronize devices. Never accept claimed `role:dm`, raw damage, dice, initiative, or token placement from browser clients on the future server. Server-side identity, a durable ID ledger, trusted dice and path/AP checks for actual player movement are required before online play. No DM UI has shipped in this phase.

## Offline DM Room UI (Draft 32)

The optional `dm.html` local tracker now imports multiple v1 character files into encounter **snapshots**, creates NPCs, edits setup values and initiative, and runs `WBEncounter` turn, AP, damage, healing, stabilization and finish actions. The sheet's HP advancement uses the same extracted `WBCombat.healthAtLevel` rules consumed by import. The local encounter persists inside game storage with existing map and character boundaries intact; imported character files are never rewritten. There is intentionally no cross-device sync or backend authority; DM actions are local and not player-authorized online actions. The next foundation steps are explicit game/character revisions, async cloud repository, authenticated members and trusted dice/turn processing, followed by battlemap/path/AP sync. Test local storage conflicts and mobile layouts before releasing multiplayer.

## DM map link foundation (Draft 33)

The DM Room can now display the same built-in map geometry as the character Battlemap and place multiple PCs and NPCs using `WBEncounter` commands. Each encounter actor's optional `mapId` keeps its coordinates tied to a specific map. A pure `WBEncounterMap` helper checks map bounds, blocked terrain and occupied cells, and the DM view presents a 5 ft grid and map artwork. A selected map updates `game.map` in local storage; encounter tokens deliberately **do not** write to existing player `game.tokens` or old foe objects, avoiding desynchronized movement and HP. The next work is server-ready actor movement with validated route length, difficult terrain, AP and current-turn ownership, followed by secure actor/token synchronization. DM manual placement is an administrative action, not a player MoveToken.

## Validated encounter movement foundation (Draft 34)

The offline encounter now has a typed `MoveToken` command. Routing, occupancy and difficult terrain are calculated from shared map definitions; `WBCombat` computes AP/Surge/leftover movement, and turn ownership is checked before committing a revision. The DM UI previews the cost and explicitly separates free administrative placement. This is **not yet real multiplayer**: map context, player identities and role fields still come from local code. Implement server-established map/actor authority, protected persistent action IDs, explicit character-to-encounter reconciliation and transactional revisions before enabling online movement. Character sheets and DM map positions remain distinct.

## Same-browser player preview (Draft 35)

The first player-facing encounter page now reads the same optional game encounter as the DM Room. It shows a selected PC's own stats/turn and public token locations, and can submit only MoveToken, SpendAP or EndTurn through `WBPlayerSession`/`WBEncounter`. Same-origin tabs receive changes via `storage`; remote browsers do not. `ownerId` and seat selection in this prototype provide no authentication. Do **not** expose game save JSON directly to remote clients: it contains private DM/NPC stats. The next backend must securely identify a joined player, authorize the actor, return redacted player snapshots and perform transactional revisioned command handling on the server (including movement dice and initiative where applicable). Join codes should identify the session, not act as sole authorization.
