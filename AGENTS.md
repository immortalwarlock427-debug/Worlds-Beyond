# Working on Worlds Beyond

These instructions are for any AI assistant working on this repository (Claude, GPT/Codex or others).

Read these first:
1. `docs/CONTEXT.md`: the rules summary, how I want you to work, the sheet's assumptions, open design questions.
   It's the main copy of the project context.
2. `README.md` and `docs/ARCHITECTURE.md`: what the site is and how the code and saves fit together.
3. `docs/ROADMAP.md`: what's next.

The rules themselves are in Notion under D&D > Game Systems
(https://app.notion.com/p/351c72092efb8089812cd231debc3e74). Weavecasting is a separate magic system: don't mix its
rules in.

- The sheet should follow the rules, but everything should stay resettable or changeable in case someone messes up.
- When a rule changes, update Notion, the site and `docs/CONTEXT.md` to match.
- Critically evaluate ideas: flag contradictions, redundancies, exploits, unnecessary rules and knock-on effects.
  Don't invent extra restrictions unless they're actually necessary. Write multipliers as 1.5× or 150%.
- Keep the character and the game apart (see the two saves in `docs/ARCHITECTURE.md`).
- No build step: test by serving the folder (`python3 -m http.server`) and opening it in a browser, at phone width
  too. `python3 tools/build_single.py` makes the one-file version for the Claude artifact.
- Bump "Draft N" with each round of changes (it's in `index.html` and the "What the site does" heading of
  `docs/CONTEXT.md`), and keep that section up to date. Do the bump as the last step before merging, to one more than
  `main`'s current number, since two branches bumping it early always conflict.
- Commit with the GitHub no-reply email (`immortalwarlock427-debug@users.noreply.github.com`); GitHub rejects pushes
  that would publish a private email.

## Two assistants, one repository

Claude and Codex both work on this repository, sometimes at the same time. These rules keep them from overwriting
each other and make it easy to see who changed what, and why.

- **Never work straight on `main`.** Make your own branch from the latest `main` (`git fetch`, then branch off
  `origin/main`), named after yourself and the task: `claude/short-task-name` or `codex/short-task-name`. One task
  per branch, merged soon: branches that sit around drift and conflict more.
- **Check what else is in flight** before starting: the other open branches and pull requests. If one is changing
  the same files or the same rule, tell me.
- **Say who you are and why.** Start every commit subject and pull request title with your name (`Claude: ` or
  `Codex: `), and put the reason in the commit body and pull request description, not only what changed.
- **Finish with a pull request.** Update the branch from `main`, fix any conflicts, test again, then merge it into
  `main`, unless I've asked to look at it first. If you can't open a pull request, push the branch and tell me its
  name.
- **When there's a conflict,** keep what both sides meant, not just your side. If the two changes really contradict
  (two different values for the same rule, say), stop and ask me which is right. Note in the merge commit or pull
  request which files conflicted and how you settled each one.
- **Never destroy the other assistant's work:** no force-pushing `main`, no deleting branches you didn't make, and
  no reverting, resetting or stashing changes you didn't make. Uncommitted changes you didn't make are probably the
  other assistant's work in progress: leave them alone and tell me.
- **If you're working on my computer,** use your own copy of the repository (a `git worktree` or separate clone),
  not a folder the other assistant might be using. Branches don't protect a shared folder: switching branches there
  switches them for both of you.
- **Publish the Claude artifact only from `main`,** after merging, so it never shows unmerged work or flips between
  two branches.

- **GitHub Pages cache safety:** whenever publishing CSS or JavaScript changes, bump the matching `?v=...` query token for *every* local CSS/JS asset reference in `index.html`. Keep the token identical across all references; the navigation test enforces this. Without it, the deployed page can show new HTML with older cached scripts/styles (unstyled and unresponsive tabs).

- **Multiplayer foundation:** build new shared logic as DOM-free modules. Use `WBPersistence` character/game repository interfaces instead of direct `localStorage` in new features; keep keys and v1 exports compatible until an explicit migration is approved. `WBGameState` owns the pure session normalizer for the future DM view. Cloud save/auth and backend permissions are not implemented; never imply that local saves synchronize across devices.

- **Shared combat core:** use `WBCombat` from `js/combat-core.js` for stat progression, modifiers, worn gear/Armor Rating, AP and Surge movement. Keep it pure and tested; do not duplicate math in UI or future DM screens. Ability effects and per-form bonuses stay in `WBAbilities` and are passed as explicit numeric inputs. No cloud or authoritative combat server has been added yet.

- **Combat outcomes are shared:** use `WBCombat` for hit/critical/damage/defense and Death Threshold/Mercy results. Keep dice generation and presentation separate from deterministic rules; the DM view must reuse these functions instead of inventing parallel hit/Armor Rating math. This module is **not** an authoritative multiplayer server, and client-provided action outcomes must be verified before future online sync.

- **Offline encounter actions:** `js/encounter-actions.js` is the only typed DM command processor (`WBEncounter`). Reuse `WBCombat` calculations, preserve `game.encounter` as optional and keep role/revision/idempotency checks in command handling. Browser-supplied roles and damage are NOT authorization; online multiplayer needs server-established identity, trusted rolls and an unbounded/durable action log. Do not wire player token movement until map/path and AP costs can be verified.

- **DM UI:** `dm.html` + `js/dm.js` are a separate offline, locally saved DM workspace. `js/dm-characters.js` imports only compact actor snapshots from character JSON (never overwrite player files); max Health uses `WBCombat.healthAtLevel`, also used by the sheet. Route every DM action through `WBEncounter.applyAction`, save optional `game.encounter` alongside the latest map/tokens/fog/foes, and never promise live synchronization. The DM screen is not a server or authorization boundary; a player MoveToken must validate actual map/path/AP before it is allowed.

- **DM map foundation:** `js/encounter-map.js` owns pure shared terrain/occupancy checks for manual placement; `js/dm-map.js` owns map rendering. Encounter actor positions are `x,y,mapId` snapshots, not `game.tokens` or legacy foes. Do not mirror DM tokens into player movement without a validated path, AP/turn checks and an explicit source-of-truth migration. Changing `game.map` selects an existing bundled map, and map-specific positions are hidden on other maps.

- **Validated movement:** `WBEncounter.MoveToken` is the only AP-consuming encounter token movement. It must calculate its own route through `WBEncounterMap.movementRoute` from the actual map, and use `WBCombat.movePlan/spendAp/movementAfter`. Keep actor `speedFt/surgeMax/move` normalized, reset on turn start, and enforce actor/turn restrictions. Free `PlaceToken` must be clearly labeled DM administrative placement. Do not conflate encounter snapshots with `game.tokens` or real cloud/player authority.

- **Player preview:** `player.html`, `js/player.js` and pure `WBPlayerSession` are an offline **same-browser** player preview. Only MoveToken/SpendAP/EndTurn are player commands; state should show own combat stats and public actor positions/names without disclosing NPC HP/AR. Seat selection is unauthenticated (imported ownerId may be `offline`), so do **not** reuse that identification or client-provided map context for actual cross-device security. Real multiplayer must use backend authentication, authorization, redacted snapshots, and transactional revisions. Never mutate character sheet or legacy map tokens through this view.

- **Cloud character foundation:** `cloud.html`, `js/cloud.js` and `js/cloud-characters.js` are manual opt-in private character saves. `supabase/migrations/20261028230000_private_characters.sql` provides owner-only RLS and expected-revision updates; activation requires a separate Supabase project. No service-role key in browser code, no silent local overwrites, no automatic background sync, and never upload `game.encounter` or DM fog to player-owned character records. See `docs/SUPABASE_SETUP.md`.
