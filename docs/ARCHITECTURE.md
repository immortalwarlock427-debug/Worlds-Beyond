# How the site fits together

## Files

- Navigation: a Character/Battlemap switch inside Character menu and persistent character sub-tabs. `js/app.js` toggles the existing section nodes with `data-sheet-section`; no duplicated data or new persistence format. URL fragments `#map`, `#status`, `#sheet` and `#sheet/<tab>` remain supported.
- `index.html` holds the markup for both views (Sheet and Battlemap, switched with `#sheet` / `#map` in the link). Character Export, Import, and Clear actions are in the top toolbar and work from either view.
- `css/sheet.css` holds every style. Colors are tokens on `:root` with a dark theme.
- `js/persistence.js` owns the browser-independent character JSON file contract and injectable local/in-memory **CharacterRepository** / **GameRepository** adapters. Local storage keeps the same two keys. The app uses the repositories instead of calling localStorage directly. Future cloud adapters should preserve this data ownership boundary.
- `js/combat-core.js` is a DOM-free deterministic math module (`window.WBCombat`): level history and ASI scores, effective scores and modifier overrides, worn gear/Armor Rating, AP and Command spending/refunds, and movement planning with Surge. The character sheet calls these pure functions; they also work in Node/vm and can power an offline DM view. Temporary ability and form bonuses come from `WBAbilities` as explicit numeric inputs to effective score/modifier functions; this avoids modifying base progression or duplicating those features.
- `js/encounter-actions.js` owns the offline typed encounter action protocol (`WBEncounter`): initiative, turn transitions, AP, DM-approved damage/healing and placement, revisions and replay protection. It calls `WBCombat` and does not draw dice or access storage. Roles supplied by the UI are only local hints, not online security.
- `js/game-state.js` owns a pure normalizer and blank factory for DM-owned game/session state (map, tokens, fog, foes, view), shared by the existing battlemap and a future offline DM screen.
- `js/maps.js` defines `window.WB_MAPS`, the maps that come with the site. Add a map there; the app needs no change.
- `js/status.js` owns the character-level status screen and manual condition timers. The status UI summarizes existing `js/abilities.js` effects without copying the effective stats into another save.
- `js/abilities.js` owns the player-built Ability Library (search, categories, favorites, metadata); it stores data on the character, not the game, and does not change combat math.
- `js/resources.js` owns the optional custom resource manager; its resources live on the character, not the game. Existing Mana/Holy Power values remain intact and may be hidden.
- `js/app.js` is the main application script for now. Its sections, in order: rules data (stats, milestones, gear),
  loading and saving, rules math, pools, trackers, AP and movement, Command, defenses, dice and attacks, health and
  death, stat increases, equipment and the Forge, drag and drop, advancement, portraits, the battlemap, rendering,
  export and import. Continue extracting pure character commands in the B1/B2 stages (see the roadmap); the offline DM screen already exists.

## Character Overview presentation

Health and AP/reactions are the first Overview controls, followed by current-form favorites. The original controls are moved rather than copied: their ids, editable values and save fields stay unchanged. The damage shortcut stays visible; healing/recovery details and Command actions are disclosures. Profile/portrait fields remain on Overview below the live controls, reachable from Character details. Character menu contains export/import, links and the main view switch; destructive reset requires its own disclosure and the existing confirmation. `js/sheet-layout.js` handles disclosure keyboard/focus behavior only.

Overview favorites render inside the existing `WBAbilities.init` controller and use the same activation helper as library cards, including AP/resource checks, charges, cooldowns and form availability. Library search/filter settings do not hide Overview favorites. No second payment implementation or save collection is introduced. Favorite and library Use buttons both execute `ActivateAbility` through `WBCharacter`; the same transaction covers AP/Mana/custom-resource costs, charges, capacity, cooldown and duration.

## Repository boundary (foundation refactor)

- Character repository: `load()`, `save(state)`, `remove()`. Game repository: `load()`, `save(game)`. `createLocalRepositories(() => window.localStorage)` defers accessing storage until needed; the adapter's errors propagate so the UI can display a warning. `createMemoryRepositories()` provides an isolated in-memory adapter for tests and the offline DM prototype.
- `WBPersistence.exportCharacter(state)` produces the original `{ format: 'worlds-beyond-character', version: 1, exported, state }` shape; `parseCharacterFile` accepts that version or the old raw `{ fields, hist, ... }` exports, rejecting malformed/future formats. Existing character field normalization and embedded-battlemap migration still happen in `js/app.js` after loading. This is **not yet** a schema-v2 migration engine or cloud sync.
- Character writes compare the raw saved bytes with the copy loaded by this tab before autosave, immediate portrait save, import or clear. A storage event or a mismatch pauses writes and exposes reload/export recovery; visibility resume rechecks too. Unreadable JSON is not replaced by the blank fallback. These checks are synchronous localStorage guards, not database transactions; legacy/stale app versions can still write unconditionally.
- Local `save()` still debounces 250ms and writes the character and game independently with the **same storage keys and object layouts**. Character edits do not rewrite an unchanged game. When the sheet changes its Battlemap, it rebases those changed top-level game sections onto the newest stored game so a newer DM encounter or Player Preview update is not erased. Concurrent edits to the same top-level section remain last-writer-wins because localStorage is not transactional. Immediate portrait saves, import/export and Clear Character use the same repository.
- New pure `WBGameState.normalizeGame` is an extracted implementation of the previous `normalizeGame`, avoiding separate DM combat data structures.
- A future online repository requires asynchronous operations, user authentication, revision-based conflict protection and backend authorization. The current synchronous local adapters are an initial interface only, not a secure multiplayer backend.

## Two separate saves

The browser keeps two things apart, because a character and a game have different owners once the site is shared:

| localStorage key | What it holds | Who will own it online |
|---|---|---|
| `worlds-beyond-sheet-v1` | One **character**: fields, stats, gear, AP, Health, portraits, and an `id` | The player |
| `worlds-beyond-game-v1` | The **game**: which map, every character's token (by character `id`), enemies, explored fog, how the map is drawn | The DM |

- **Export character** writes only the character (`{ format: 'worlds-beyond-character', version: 1, state }`).
  The battlemap never travels with a character.
- A character's `id` (`c` + letters and digits) is how the game knows which token is theirs: `game.tokens[id]`.
- Saves from drafts before the website kept the battlemap inside the character. When one loads, its map, token,
  enemies and fog move into the game if this browser's game hasn't been started, and leave the character either way.

### The game object

```
{
  map:    { id, rev, cols, rows, free, fogOff },   // cols and rows only matter for the blank grid
  tokens: { [characterId]: { x, y } },            // squares are column x and row y, from 0
  fog:    { [mapId]: { rev, seen: '0101…' } },     // squares the party has seen, row by row
  foes:   [ { id, map, x, y, name, hp, max, ev, ar } ],
  view:   { grid, terrainOn, reachOff },           // how this browser draws the map
  encounter: { /* optional WBEncounter snapshot: actors, turns, map placement, revisions */ }
}
```

## The battlemap's rules, as coded

- **Movement:** every square is 5 ft, diagonals included; difficult terrain (rubble, water, bones) is 10 ft; you
  can't slip diagonally between two blocked squares that touch at a corner. Paying goes through the same code as
  the Movement panel: leftover feet, then Surge, then AP from a Command, then your own AP.
- **Planning on what you know:** a route treats squares you haven't seen as open floor and only avoids enemies you
  can see. The walk checks each next square as you reach it; if something you couldn't see is in the way (a wall,
  an enemy, or difficult terrain you can't afford), you stop next to it and pay only for the distance walked.
- **Sight:** a square is visible if a straight line reaches it without passing through walls, pillars, sealed doors,
  burial niches or magical darkness, and it's lit or within your sight in the dark. The squares next to you are always
  visible (except magical darkness). Sight in the dark = the farther of Darkvision (sheet, plus gear) and the light
  you carry (sheet or the map's Light picker, or gear that sheds light).
- **Light:** a map is `light: 'lit'` or `'dark'`. A dark map lists `lights` ({ x, y, ft }), each lighting the squares
  within that distance that it can reach in a straight line. `void` rows mark magical darkness.
- **Enemies:** standing enemies block movement through and onto their square; downed ones can be walked past but
  not stood on. Attacks need the target in range (5 ft unless the weapon's Range says otherwise) and a clear line.
  A hit meets or beats Evasion, and a natural 20 always hits and can't be dodged (Block and Parry still work). Armor Rating comes off each hit (for a two-weapon
  attack, each hand separately, the off-hand after halving).

## Mechanical form score and portrait links
- Each `abilityLoadouts[]` entry may carry `portraitId` and a `statBonuses` object keyed by the eight homebrew stats. `WBAbilities.formStatBonus(state, stat)` is a derived component of `score(stat)` only; do not mutate level-history stats or slot gear. `selectLoadout` switches the selected portrait only if linked, while `selectPortrait` switches the active mechanical form from a selected Overview portrait (or to Base when unlinked). Both use stored ids, and Overview portrait selection calls `refreshAll()` so available abilities and derived values update. Missing portrait references are removed by character normalization.
  
## Form-specific custom resources
- `state.resources[].loadoutIds` uses the same stable ability form ids as `state.abilities[].loadoutIds`. Empty is shared. The resource manager only renders available pools unless Show all is enabled; actual ability activation and regen gate independently on availability, so hidden resources cannot be spent via stale UI. Current values do not get reset on form switches. Built-in Mana is controlled by each form's `manaMode` (`inherit`/`show`/`hide`), layered over the original global `showMana` flag. Rest intentionally restores opted-in pools across forms.

## Form-specific equipment profiles
- `js/equipment-profiles.js` maintains `state.equipmentProfiles`: a `base` slot mapping and one mapping per named ability form, with `state.equip` as the currently worn, authoritative slot mapping. All profiles refer to shared `state.items` IDs; items are never copied or cloned.
- `WBEquipment.switchForm(state, nextId)` snapshots current worn slots before restoring the target profile. Linked portrait switching uses the same path. New forms inherit the currently worn set, then diverge. Deleting a form restores Base (if currently active) and deletes only its profile; removing an item scrubs every saved profile. Import normalization removes missing or incompatible slot assignments.
- No changes to `state.settled` (long-rest gear progression), `state.spent` (per-item uses), `state.resources`, AP or other trackers on transformations. Equipping/unequipping manually still follows existing advancement rules. The current profile is captured before local saves and character exports.

## Ability form loadouts
- Character state keeps `abilityLoadouts` (stable ids and names), `activeAbilityLoadoutId`, and per-ability `loadoutIds` (empty means shared). Loadout switching doesn't reset trackers or change the underlying character stats and resources; ability availability validation gates activation. Portrait `formId` and `portraits` are intentionally independent.
  
## Ability Library presentation
- `js/abilities.js` keeps filters and compact mode in view state, not in serialized character data. The readiness filter calls the same `checkActivation` validation as the Use action but never charges AP or resources. Filters respect stable resource identifiers and respond to normal sheet refreshes.

## Static asset versioning

GitHub Pages may serve updated HTML while a visitor's browser still has older CSS/JS cached. All four application pages use a shared `?v=...` release token on `css/sheet.css` and all `js/*.js` script references. **Every release that changes CSS or JavaScript should bump the shared token on all four pages** so the browser fetches matching files on production rather than mixing versions. The navigation regression suite discovers every local JS/CSS reference across all pages and checks the shared token and Draft labels. Avoid changing character storage keys to solve cache issues.

## Next architectural boundary

The app currently uses a mutable `state` in `js/app.js` and separate browser keys for the character and game. To support cloud saves and DM multiplayer safely, extract rule actions from DOM handlers and use local/cloud repository adapters rather than replacing localStorage with direct remote writes. See [Cloud & Multiplayer Plan](CLOUD_MULTIPLAYER_PLAN.md) for identity, ownership, offline sync, permissions and migration priorities.

## Shared combat-engine migration

The first combat-core PR replaces existing calculations in `js/app.js` with pure `WBCombat` functions without changing current save formats. The rules module is deterministic and receives state, current AP/movement, or explicit modifiers as parameters; it never reads the DOM, browser storage, network or dice randomness. Source-of-truth stat and gear data live in the character record, not the DM game record. For new DM features, reuse these functions and `WBAbilities` rather than introducing new formulas. Next extraction should handle attack/damage and defenses; then construct encounter actions validated against an authoritative game state. Cloud/server enforcement is a separate future phase.

## Shared combat resolution (phase two)

`js/combat-core.js` now also exports pure combat decision functions. `attackHits` and `dualHits` handle hit checks including natural 20; `criticalTotal`, `damagePacket`, `offhandDamage`, `armorDamage`, and `dualArmorDamage` calculate criticals, weapon and extra damage, and dual-wield per-hit armor. `resistedDamage`, `overwhelmFloor`, `afterArmor`, and `defenseResult` resolve resistance, Armor Rating, Overwhelming Force, block/dodge/parry, and area saves. `deathThreshold`, `diesAt`, and `damageHealth` compute health/death state transitions and Death's Mercy. The sheet now calls these functions directly; dice rolling, UI messages, mutation, persistence, and turns remain with the app. The pure combat module has no DOM, localStorage, networking, or random dice calls.

Do not create a second attack or defense rules implementation in a DM interface. The **next** layer should receive typed, validated commands (actor, target, expected session revision and action details), check permissions/turn order/AP/resource costs, apply the shared calculations in one authoritative location, then persist and publish the new state. Currently there is no server authority or real-time sync.

## Validated encounter actions (offline foundation)

`WBEncounter.createEncounter(id)` creates a DM-owned encounter; `normalizeEncounter(data)` validates a saved encounter; `applyAction(encounter, action, context)` returns `{ok, state, event, duplicate}` or `{ok:false,error}` without mutation. Every action has a unique `id`, `type` and `expectedRevision`. Accepted commands increment the revision; an exact retry returns `duplicate:true`, while a reused ID with changed payload fails. The last 256 IDs are cached for local retry protection, **not** a durable or tamper-proof server action log. NPC stats are encounter snapshots, not edits to imported player sheets.

Currently supported: AddActor, RemoveActor, SetInitiative, StartEncounter, EndTurn, SpendAP, GrantAP, ApplyDamage (one hit at a time, using the shared resistance/armor and Death's Mercy rules), Heal, SetHealth, PlaceToken (DM manual placement) and FinishEncounter. Turn starts refresh AP and apply bleeding; healing above zero adds Trauma as in the sheet. DM-only operations reject player commands. Local player movement is implemented; ability execution in encounters, genuine random dice, attack-roll verification, server permissions and encounter cloud synchronization are **not** implemented yet. The DM screen calls this module and persists optional `game.encounter` through `WBGameState`. Existing game documents with no `encounter` remain byte-shape compatible after normalizing.

## Offline DM Room (first visible interface)

`dm.html`, `css/dm.css`, and `js/dm.js` are a standalone, responsive browser UI linked from the existing sheet. `WBDMCharacters.fromCharacter` projects character **exports** into limited combat snapshots using `WBCombat`: Health advancement, gear, VIT and AP. The original sheet's `computeLog` now delegates per-level Health to `WBCombat.healthAtLevel` so imported max Health follows the same rules, including historical rolls and hit-die overrides. Invalid/missing advancement is flagged for DM review; initiative is **not** automatically rolled.

The DM controller never edits `characters`; it reads `games` through `WBPersistence`, verifies the local encounter revision, invokes `WBEncounter.applyAction`, and writes only a replacement optional `game.encounter` merged into the latest normalised map, tokens, fog and foes. Existing game documents without an encounter normalize identically. For simultaneous browser tabs, the `storage` event prompts a reload of encounter data, but localStorage is not a transactional concurrency system: online sync will need a backend and authoritative writes. All player commands are DM-operated locally. No authenticated multiplayer, encounter timers for imported effects, or real dice protocol has shipped. Path/AP-validated movement exists locally.

## DM tactical battlemap

`js/encounter-map.js` supplies pure `WBEncounterMap.mapModel`, `blocked`, `tokenActors`, `checkPlacement`, and `squareName`, taking `window.WB_MAPS` definitions with the same default 20×15 blank grid as the sheet. `js/dm-map.js` renders the scrollable board in `dm.html` with terrain imagery and visually distinct PC/NPC tokens. Board clicks produce typed `PlaceToken` or `ClearToken` DM commands through `js/dm.js`; the encounter processor checks bounds, blocked terrain and occupied squares when map context is provided. `actor.mapId` is nullable and tied to manual placements; legacy snapshots without this property remain valid. Map selection persists through the **existing** game map record (not a new character setting) and does not forcibly move tokens between maps.

**Ownership note:** `encounter.actors[].x/y/mapId` are currently the sole source for DM roster token positions. They are **not** synchronized into `game.tokens` (the current character-sheet movement view) or `game.foes` (the legacy battlemap enemy set), because doing so without validating attack/movement permissions would silently overwrite player movement and create two competing HP sources. All DM-only positioning is free/manual; the next phase must add authoritative path/AP validation and reconcile those records before enabling shared player moves. DM sees whole map terrain (no player fog in this view); this is not cloud multiplayer.

## Encounter movement

`WBRouting.findPaths` is the single DOM-free Dijkstra route engine for DM and character Battlemap. It uses cardinal/diagonal five-foot steps, 10-ft entry for rough terrain (`r`, `w`, `b`), impassable terrain and corner restrictions. Standing opponents block; allies and all downed creatures may be crossed at normal cost but are illegal destinations. The sheet passes a fog mask and only visible foes, then rechecks each step of the animated walk when new obstacles appear. DM uses full terrain and the roster's editable Party/Enemy sides; old actors infer side from PC/NPC kind. `WBEncounter.applyAction` owns the `MoveToken` action: validates active turn/owner/map/coordinates, recalculates the path on the supplied DM-owned map model, then delegates resource costs to `WBCombat.movePlan`, `spendAp` and `movementAfter`. It persists per-actor `speedFt`, `surgeMax`, and `move:{ft,left,surge}`. Turn start resets move counters; existing encounter saves normalize missing fields to safe defaults.

The DM UI has explicit `DM placement (free)` and `Combat movement (AP)` modes. Clicking a destination in combat mode previews a visual route and cost; Confirm submits `MoveToken`. Preview is invalidated when actor, map, mode or encounter revision changes. Imported player Movement uses the sheet's effective AGL, gear, manual override and ability/form bonuses at import time; NPC values are configurable. The game save still uses `game.encounter` for roster positions, separate from `game.tokens` and `game.foes`. Browser-supplied context remains offline-only and is not secure authorization. Never trust map definitions, actor permissions or client dice on a future server.

### Encounter setup and controls

`WBDMMap` renders map choice buttons (native select retained hidden for legacy compatibility), follows the active initiative actor in AP movement mode, disables AP movement in setup/finished phases, and writes inline map notices for invalid paths and completed moves. `WBEncounter.ReopenSetup` is DM-only and accepts only finished encounters; it resets round/index and per-turn AP/Surge/movement but preserves roster, HP, map placement and initiative, enabling an editable next fight without player reimport. Existing `createEncounter` still makes an empty encounter when explicitly requested.

### Route presentation

The encounter pathfinder uses direction-aware shortest paths with a lexicographic route preference: movement feet, number of diagonal steps, turns, and straight-line deviation. This preserves the original 5-ft or 10-ft cost model while avoiding equally costly zigzags. The DM UI consumes the verified `MoveToken` event path, persists AP/position first, and animates an overlay token through each waypoint (170 ms per adjacent square). The saved destination token stays hidden while traveling, then reappears when the overlay completes or is canceled. Reduced-motion skips the animation; interactions with another map/encounter invalidate the overlay safely. This is client-side presentation only; no extra movement actions are issued per visual frame.

## Local Player Encounter Preview

The same-browser player page `player.html` uses `js/player.js`, `css/player.css`, and the pure `WBPlayerSession` adapter (`js/player-session.js`). `seats` lists only PCs, `view` exposes selected-PC details plus public name/initiative/map positions of other combatants (no enemy HP/AR), and `issue` accepts only `MoveToken`, `SpendAP`, and `EndTurn` before delegating to the shared `WBEncounter` action processor. The page reads/writes `WBPersistence.games` and merges `game.encounter` into normalized map/fog/legacy foes, using the existing revision check and `storage` event to update other local tabs. Movement uses `WBEncounterMap.movementRoute` and `WBCombat.movePlan` for preview; saved command events can drive token animation.

**Not a security boundary:** `ownerId` in imported files is currently `offline` and the player seat chooser is entirely client-side. A hostile user can select other PCs or modify browser data. Before any remote access, move seat ownership, redacted read models, visibility/fog, dice, and commands to authenticated backend enforcement. localStorage offers no transactional concurrency safety; don't market this view as cross-device multiplayer.

## Optional character cloud repository

`js/cloud-characters.js` is a browser-independent async Supabase v2 adapter. Auth derives the current user via `client.auth.getUser()`; the SQL table `wb_characters(owner_id, character_id, name, document, revision, updated_at)` has explicit owner-based RLS policies and no anonymous grants. The adapter saves through create or a conditional `.eq('revision',expected)` update, returning `REVISION_CONFLICT` if zero rows match. Deletes likewise check revision. Each local character copy carries a `cloudSync` receipt (`endpoint`, `ownerId`, `revision`) set only after a successful save/restore; list refresh cannot update it. Legacy copies with an existing cloud row need export/restore first. Restore and post-upload receipt writes also check that the local character did not change while awaiting the server. Deletes continue to use the reviewed list revision. There is no automatic merge of local/cloud state and no global game sync. `js/cloud.js` is a manual opt-in UI that reads only the local character repository, backs up before restore and never updates `WBPersistence.games`. Auth uses the public default project configuration or an Advanced override. The Supabase SDK loads only on Cloud Saves, pinned to an exact version with SHA-384 integrity verification. New project config must be provisioned separately (see `docs/SUPABASE_SETUP.md`). Never use browser key configuration as proof of access; database RLS enforces private reads/writes.

## Implementation invariants and current boundaries

- **Rule sources:** `WBCombat` is pure and deterministic for stats/gear/AP/movement/attacks/defenses/death, while `WBAbilities` supplies form/effect modifiers. Do not duplicate math in UI or substitute dice animation for a validated result.
- **Persistence:** `WBPersistence` keeps the character and DM game browser keys separate; `WBGameState` normalizes DM session state. `game.encounter` owns offline actors, position (`x,y,mapId`), AP, initiative and movement independently of legacy `game.tokens` and `game.foes`. Imported actors are disconnected snapshots.
- **Movement:** `WBEncounter.MoveToken` recomputes a route from current encounter/map state and applies `WBCombat.movePlan/spendAp/movementAfter`; DM `PlaceToken` is free administrative placement. `WBEncounterMap.movementRoute` and `js/app.js`'s fog-aware Battlemap both call `WBRouting.findPaths`; sheet movement still stops on newly discovered obstacles and charges only for the distance traveled.
- **Form effects:** stat bonuses, portrait links, per-form custom-resource availability and worn-gear profiles coexist without rewriting historical level scores. Effective scores from forms/equipment/effects may exceed 28 and continue to unlock milestones. Optional form-entry AP/resource costs are implemented. Ability stat discounts are **not yet implemented**.
- **Local player demo:** `WBPlayerSession` only filters the selected actor's UI/MoveToken/SpendAP/EndTurn for another tab in the same browser origin; its ownerId and role hints are **not authenticated**. Actual phone-player sessions need backend membership, server-side read filtering, authenticated actions and revision-safe writes.
- **Private cloud characters:** `cloud.html` imports public `js/cloud-config.js` with site URL/publishable key, an Advanced override, and `WBCloudCharacters`. Only manually saved player character documents go to Supabase `wb_characters` with owner-only RLS and expected-revision conflicts. No cloud DM game sync; never ship secret/service-role keys.
- **Target deployment:** DM on a computer or phone, players on their own phones at an in-person table. The next multiplayer artifact is an approved **design plan**, not an implementation.

### Documentation rules

Keep CONTEXT and ROADMAP accurate in place instead of appending per-PR histories. Keep AGENTS short and store technical invariants here. Rules and site changes should be reconciled with Notion where appropriate.

### DM import of temporary ability effects

`WBDMCharacters.fromCharacter` imports current gear and selected form modifiers but deliberately does not include active `ability.durationLeft` effects in VIT/AGL/WIS, Armor Rating, Movement, Surge, or Initiative. Explicit sheet overrides are preserved. The importer never modifies the source character or adds timed effects to the encounter; it returns one warning for each active ability with its numerical targets and remaining turns. `js/dm.js` displays every warning as escaped text in `#dmImportWarnings`, including when more than four are active, and the DM can adjust the snapshot in setup. Duration-aware effects in encounters remain a separate future feature.

### Named form entry costs

Named form and linked-portrait selections execute `EnterForm` / `SelectPortrait` through `WBCharacter`, using the existing `WBAbilities` and `WBEquipment` rules on a private working copy. Named `abilityLoadouts[]` entries may store `entryApCost`, `entryResourceId` and `entryResourceCost`. Empty/zero costs mean free. `WBAbilities.entryCost` checks AP and the selected built-in Mana/Holy Power or custom resource before changes. `selectLoadout` and `selectPortrait` share the entry payment path before changing active form, linked portrait, equipment or balances. The Ability Library and Overview supply the same AP/Mana callbacks; a failed cost changes nothing. Switching to Base and reselecting the same form are always free. Entry resources are charged even when the destination form normally hides the pool, since the explicit entry charge belongs to the transformation itself.

### Character command boundary

`js/character-core.js` defines pure `WBCharacter.derive(state)` and `WBCharacter.apply(state,command)`. It depends on the DOM-free helpers in `WBCombat` and `WBAbilities`, loaded before the command module. Derivation returns custom resources, `ap:{max,own,given,total}` and `mana:{kind,automaticMax,max,current,visible,configured,available}`. It never reads input elements, writes state or emits events. Null AP and blank Mana remain full sentinels. Mana advancement uses historical INT/FTH/ASI, level-up gear snapshots and current explicit Max Mana/Holy Power equipment bonuses; temporary/form stat boosts are not retroactive. The table and hit-die helpers are shared with the sheet's advancement display.

AP/Mana commands are `SpendAP`, `RefundAP`, `SpendMana`, `SpendPools`, `SetAPCurrent`, `SetAPMaximum`, `SetManaCurrent` and `SetManaMaximum`. They return a new state, a minimal root patch for the UI bridge, deterministic `ap.changed`/`mana.changed` events with before/after snapshots and correction/command sources, and a readable log. Negative/nonfinite payments and insufficient pools reject without a patch or input mutation. Command AP is spent before personal AP; refunds retain the existing own-first/overflow behavior. Manual Mana values can remain above the maximum or negative; spendable Mana is nonnegative. AP retains the existing 40-point tracker bound. Hidden Mana stays stored; spending it requires the explicit form-entry flag.

The sheet applies patches to the existing character object, keeping active editor references stable. AP pips, ordinary AP spends/refunds, manual AP/Mana current/max edits and the shared ability/form AP/Mana callbacks use this boundary. `SpendPools` validates both AP and Mana before either changes. The form transaction plans payment before switching equipment and applies the existing custom-resource/form/portrait logic only on its private working copy before publishing the complete patch. This preserves the old-profile meaning of a blank Mana balance when the destination gear changes its maximum. Returning to Base and reselecting the active form remain free. Standalone `WBAbilities` rule helpers still support injected cost callbacks for isolated callers. The production runtime controllers publish only complete `WBCharacter` transactions; they do not commit partial payment plans themselves.

Custom-resource commands retain Spend/Gain/Fill/Set current/Set maximum/Turn start/Long rest and maximum-drop reconciliation. Resource results update existing resource objects to preserve editor references. Rendering/loading must never trigger commands or truncate valid boosted balances.

`ActivateAbility`, `EnterForm` and `SelectPortrait` clone only their owned working records (fields, Command record, abilities/resources, worn slots and profile maps), reuse the existing ability/equipment helpers, and publish a patch after every step succeeds. Portrait image strings, progression data and unknown fields remain read-only/shared. A false/throwing equipment helper cannot leak its private changes or spend costs on the real character. This boundary expects the normal character load/normalization first; it does not normalize definitions, invent ids or use DOM/clock/random values.

Transaction events describe the complete before/after state, including gear-driven Mana maximum changes. They include AP/Mana snapshots, custom-resource current/maximum changes, one `ability.used` event per successful activation, `form.left`/`form.entered`, and portrait/equipment changes when applicable. Rejections have no patch/events; a free unlimited ability can still emit its use event without a balance change. These events are returned to callers, not wired to automatic triggers or retained as a durable log.

The UI merges ability/resource records by id when committing, preserving existing editor references. Portrait removal performs its fallback selection successfully before removing/unlinking the picture. Definition creation/editing/deletion and manual tracker reset/end/release controls remain configuration/controller operations; explicit runtime Use and form/portrait selection use the command boundary.

This is not yet one authority for the whole character: Health, turn/rest orchestration, existing manual runtime corrections and undo snapshots remain follow-ups. The implementation order and decision gates are in `docs/AUTOMATION_PLAN.md`; the next task is in `docs/CODEX_START_HERE.md`.
