# How the site fits together

## Files

- Navigation: a top-level Character/Battlemap switch and nested character sub-tabs. `js/app.js` toggles the existing section nodes with `data-sheet-section`; no duplicated data or new persistence format. URL fragments `#map`, `#status`, `#sheet` and `#sheet/<tab>` remain supported.
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
  export and import. Splitting it into modules is planned with the DM screen (see the roadmap).

## Repository boundary (foundation refactor)

- Character repository: `load()`, `save(state)`, `remove()`. Game repository: `load()`, `save(game)`. `createLocalRepositories(() => window.localStorage)` defers accessing storage until needed; the adapter's errors propagate so the UI can display a warning. `createMemoryRepositories()` provides an isolated in-memory adapter for tests and the offline DM prototype.
- `WBPersistence.exportCharacter(state)` produces the original `{ format: 'worlds-beyond-character', version: 1, exported, state }` shape; `parseCharacterFile` accepts that version or the old raw `{ fields, hist, ... }` exports, rejecting malformed/future formats. Existing character field normalization and embedded-battlemap migration still happen in `js/app.js` after loading. This is **not yet** a schema-v2 migration engine or cloud sync.
- Local `save()` still debounces 250ms and writes the character and game independently with the **same storage keys and object layouts**. Immediate portrait saves, import/export and Clear Character use the same repository.
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
  view:   { grid, terrainOn, reachOff }            // how this browser draws the map
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

GitHub Pages may serve updated HTML while a visitor's browser still has older CSS/JS cached. The HTML uses a shared `?v=...` release token on `css/sheet.css` and all `js/*.js` script references. **Every release that changes CSS or JavaScript should bump the shared token in `index.html`** so the browser fetches matching files on production rather than mixing versions. The navigation regression suite checks that all references share a token. Avoid changing character storage keys to solve cache issues.

## Next architectural boundary

The app currently uses a mutable `state` in `js/app.js` and separate browser keys for the character and game. To support cloud saves and DM multiplayer safely, extract rule actions from DOM handlers and use local/cloud repository adapters rather than replacing localStorage with direct remote writes. See [Cloud & Multiplayer Plan](CLOUD_MULTIPLAYER_PLAN.md) for identity, ownership, offline sync, permissions and migration priorities.

## Shared combat-engine migration

The first combat-core PR replaces existing calculations in `js/app.js` with pure `WBCombat` functions without changing current save formats. The rules module is deterministic and receives state, current AP/movement, or explicit modifiers as parameters; it never reads the DOM, browser storage, network or dice randomness. Source-of-truth stat and gear data live in the character record, not the DM game record. For new DM features, reuse these functions and `WBAbilities` rather than introducing new formulas. Next extraction should handle attack/damage and defenses; then construct encounter actions validated against an authoritative game state. Cloud/server enforcement is a separate future phase.

## Shared combat resolution (phase two)

`js/combat-core.js` now also exports pure combat decision functions. `attackHits` and `dualHits` handle hit checks including natural 20; `criticalTotal`, `damagePacket`, `offhandDamage`, `armorDamage`, and `dualArmorDamage` calculate criticals, weapon and extra damage, and dual-wield per-hit armor. `resistedDamage`, `overwhelmFloor`, `afterArmor`, and `defenseResult` resolve resistance, Armor Rating, Overwhelming Force, block/dodge/parry, and area saves. `deathThreshold`, `diesAt`, and `damageHealth` compute health/death state transitions and Death's Mercy. The sheet now calls these functions directly; dice rolling, UI messages, mutation, persistence, and turns remain with the app. The pure combat module has no DOM, localStorage, networking, or random dice calls.

Do not create a second attack or defense rules implementation in a DM interface. The **next** layer should receive typed, validated commands (actor, target, expected session revision and action details), check permissions/turn order/AP/resource costs, apply the shared calculations in one authoritative location, then persist and publish the new state. Currently there is no server authority or real-time sync.

## Validated encounter actions (offline foundation)

`WBEncounter.createEncounter(id)` creates a DM-owned encounter; `normalizeEncounter(data)` validates a saved encounter; `applyAction(encounter, action, context)` returns `{ok, state, event, duplicate}` or `{ok:false,error}` without mutation. Every action has a unique `id`, `type` and `expectedRevision`. Accepted commands increment the revision; an exact retry returns `duplicate:true`, while a reused ID with changed payload fails. The last 256 IDs are cached for local retry protection, **not** a durable or tamper-proof server action log. NPC stats are encounter snapshots, not edits to imported player sheets.

Currently supported: AddActor, RemoveActor, SetInitiative, StartEncounter, EndTurn, SpendAP, GrantAP, ApplyDamage (one hit at a time, using the shared resistance/armor and Death's Mercy rules), Heal, SetHealth, PlaceToken (DM manual placement) and FinishEncounter. Turn starts refresh AP and apply bleeding; healing above zero adds Trauma as in the sheet. DM-only operations reject player commands. Player movement, ability execution, genuine random dice, attack roll verification, server permissions and cloud synchronization are **not** implemented yet. Later the DM screen will call this module and persist optional `game.encounter` through `WBGameState`. Existing game documents with no `encounter` remain byte-shape compatible after normalizing.

## Offline DM Room (first visible interface)

`dm.html`, `css/dm.css`, and `js/dm.js` are a standalone, responsive browser UI linked from the existing sheet. `WBDMCharacters.fromCharacter` projects character **exports** into limited combat snapshots using `WBCombat`: Health advancement, gear, VIT and AP. The original sheet's `computeLog` now delegates per-level Health to `WBCombat.healthAtLevel` so imported max Health follows the same rules, including historical rolls and hit-die overrides. Invalid/missing advancement is flagged for DM review; initiative is **not** automatically rolled.

The DM controller never edits `characters`; it reads `games` through `WBPersistence`, verifies the local encounter revision, invokes `WBEncounter.applyAction`, and writes only a replacement optional `game.encounter` merged into the latest normalised map, tokens, fog and foes. Existing game documents without an encounter normalize identically. For simultaneous browser tabs, the `storage` event prompts a reload of encounter data, but localStorage is not a transactional concurrency system: online sync will need a backend and authoritative writes. All player commands are DM-operated locally. No player authentication, active effects synchronization, real dice protocol, or path-validated movement has shipped.
