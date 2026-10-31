# Roadmap

Future-facing development priorities for Worlds Beyond. Current shipped behavior is in [CONTEXT.md](CONTEXT.md), implementation boundaries in [ARCHITECTURE.md](ARCHITECTURE.md), and the detailed character automation sequence in [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md). For a new coding agent, begin with [CODEX_START_HERE.md](CODEX_START_HERE.md).

## Current baseline (merged)

- Character Sheet with custom resources, Ability Library, forms/portraits/equipment profiles and Status Effects; character Battlemap, offline DM Room and same-browser Player Preview.
- Shared deterministic combat and offline encounter commands; shared DM/sheet movement routes, side-aware occupancy, and DM warnings when imported temporary character buffs cannot be tracked.
- Optional AP and resource costs when entering forms, free-to-Base and linked portrait switching.
- Supabase Auth and owner-only **manual** private cloud character Save/Restore across devices. No live multiplayer session.
- GitHub CI with Node tests, Playwright browser interactions and 390px layout checks.
- **PR #35 merged:** first pure `WBCharacter.derive/apply` resource-command slice, resource UI migration, and boosted resource-current preservation across reload. AP/Mana derivation, payment primitives and manual corrections now share the command boundary; runtime ability/form transactions are implemented; broader lifecycle/Health/undo work remains.

## Character sheet first

Finish the player character sheet before expanding battlemap, DM, PvP or live-session features. Keep their shared rules and save boundaries compatible; maintain regression coverage for the existing views.

Delivery sequence:
- Phone Overview and navigation: Health, AP/reactions and current-form favorite abilities first; file actions in Character menu, reset separated, profile details still editable.
- Implemented: B1/B2 shared AP/Mana commands, atomic ability/form payments and optional ability AP stat discounts with matching display/filter/payment prices.
- Implemented: optional attack/damage rolls and save DCs on ability cards and favorites. Attack, damage bonus, AP-discount, save-DC and target-save stats are independent; shared popup/gear effects/critical math and one activation payment. Wonder/Defy Fate do not apply to attacks. A dedicated Spell type and magic-table defaults remain future ability work, rather than a parallel spell list.
- Implemented: explicit character combat mode, custom ability reset periods, separate combat/outside allowances and combat-aware Parry. StartCombat is idempotent while active; EndCombat refills nothing. Implemented: seven non-weapon milestone action buttons with AP/use tracking, a WIS check for Eyes of Truth, and target save instructions for Commanding Presence. Implemented: Devastate on STR-based attack damage and Singularity on one chosen weapon hand, with shared counters, atomic attack payment and source snapshots. Implemented: Forge outside-limit settings and shared equipment charge tracking, preserving legacy defaults, edited-row counts and hidden item balances. Narrative outcomes remain table judgments.
- Implemented: character Notes with session notes, backstory, personality, languages and allies/connections, preserved across local/v1/manual-cloud saves and phone navigation.
- Next: consumables with quantities and optional healing rolls, followed by roll history and free dice. Currency, Temporary Health, innate defenses, AP growth and exhaustion require any missing setting/rule decisions first.

Keep each stage in a separate reviewable PR; do not implement unapproved mechanics or automatic multiplayer as part of the sheet work.

## Save safety and release follow-up

- **Phone backups:** keep JSON export/cloud-save guidance visible. A manifest, Home Screen instructions, a user-initiated persistent-storage request and per-character backup status deserve a separate mobile UX change. Browser storage and Home Screen installation are not guaranteed backups; test on real Safari before making retention promises.
- **Forward compatibility:** preserve unsupported item/bonus/effect data or guard newer saves before adding schema targets in B3. Current malformed-save recovery does not solve every older-code/newer-data case.
- **Cloud operations:** verify private-group sign-up/SMTP settings and two-user RLS on an isolated project; do not change production Auth or run production migrations during a code review. The new document-size constraint must be deployed through the normal migration workflow; existing oversized rows must be reduced before validating it.
- **PR #36:** retain the eight unmerged commits for review. Its form-effects/overflow work belongs after B1/B2 and DM decisions; do not merge its claimed decisions into this plan or close/delete unmerged work without an agreed disposition. Git refs alone do not prove which PRs are currently open.
- **Rules/docs outside this repo:** reconcile Notion's Charisma discount wording with the fixed 5 AP Command rule when Notion access is available. Block scaling and two-handed balance remain unresolved; historical comparisons are not approved mechanics.
- **Maintenance:** replace source-text assertions with behavioral checks as the corresponding modules change, share the remaining hit-die/DM derivation formulas during B1/B2, and review merged branches for cleanup once PR status is available. Do not remove unmerged branches or raise AP/map/token limits without a concrete supported use case.

## Development queue — one narrow Codex PR per task

1. **B1 — Implemented:** pure AP/Mana derivation, shared payment/correction commands, Command-first spending and source-profile form payments, with Node and phone interaction checks. Full character transactions remain B2 work.
2. **B2 — Ability/form slice implemented:** runtime activations and form/portrait selection atomically commit costs, uses/capacity, cooldown/duration and gear/portrait changes. Health, turn/rest orchestration, manual tracker controls and transaction-level Undo remain focused follow-ups; optional ability AP discounts now share this transaction path.
3. **Ability AP stat discounts — Implemented:** None/STR/DEX/INT/FTH; effective cost `max(ceil(base AP/2), base AP − current effective mod)`, including negative modifiers; blank/zero stays free. Cards, favorites, Use, Usable now, AP bands and sorting share the current price while preserving the base cost. **Optional ability-card rolls are also implemented:** separate attack/damage/save fields, shared popup, activation-time modifier snapshots and no second payment for damage. **Combat lifecycle and custom scoped uses are implemented:** separate combat/outside allowances, current-modifier outside round counts, pure ability lifecycle commands and Parry integration. **Seven non-weapon milestone actions are implemented:** shared atomic costs/use rules, built-in counters, narrative/save prompts and Eyes of Truth checks. **Devastate/Singularity are implemented:** STR-only damage bonus, one chosen hand on dual attacks, atomic declaration/payment and criticals distinct from natural 20. **Equipment outside-use tracking is implemented:** explicit Forge limits, shared counter commands, preserved legacy defaults and edit/removal remapping. **Character notes are implemented:** optional multiline fields, character-wide persistence and phone navigation. **Next character-sheet slice:** consumables with quantities and optional healing rolls, preserving v1 saves and phone usability.
4. **B3 — Needs DM resource choices:** derive general `effects` on named forms, configure absolute hard cap and excess policy per resource, expand long-rest policy while preserving legacy defaults, display overflow/thresholds and protect unknown newer save fields. This is **not a Rage-specific feature**.
5. **C — Automation engine:** ability-owned automatic/manual rules with genuine state-crossing or event triggers, AND requirements, own-character commands, deterministic FIFO event processing, cycle guard, rejection logs and tests.
6. **D — Ability rule editor:** human-readable rule configuration, activation selector, Test/dry-run, enable/disable and activity log; robust mobile layout and persistence. Coordinate C/D to become usable together.
7. **Cloud operation and live-session design (plan only):** account onboarding/SMTP, DM room membership and role-based filtered data, safe sessions/commands/revisions, each player on their own phone. Do not build online multiplayer without specific DM approval.

See [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md) for acceptance criteria, sample rules, action/event scope, dependencies and open design questions.

## Later improvements

- Larger map library, doors, the Barrow puzzle, ally tokens, uploaded map art and terrain/light brushes.
- Richer statuses, inventory/consumables, currency, gear sets, reusable templates and dice/DM encounter presentation.
- Cloud portrait object storage and carefully designed optional synchronization after secure ownership/conflict handling.
- Advanced automation: OR logic, reaction suggestions, hit/crit/kill triggers, other-character actions, shared rule templates and additional formulas.

## Unresolved gameplay rules — no implementation without a decision

- Rage model: genuine 100 → 200 overcharge or full-200 maximum with threshold marker.
- Whether excess survives maximum drop; typed corrections trigger automation; automatic form-entry cost default; simultaneous Manual + Automatic mode. See the exact distinctions in [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md).
- AP growth per level; Block dice and shield scaling; two-handed/dual-wield balance; small action AP costs; WIS actions; Exhaustion redesign. See [CONTEXT.md](CONTEXT.md) for those proposed mechanics.
