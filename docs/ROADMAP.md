# Roadmap

Future-facing development priorities for Worlds Beyond. Current shipped behavior is in [CONTEXT.md](CONTEXT.md), implementation boundaries in [ARCHITECTURE.md](ARCHITECTURE.md), and the detailed character automation sequence in [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md). For a new coding agent, begin with [CODEX_START_HERE.md](CODEX_START_HERE.md).

## Current baseline (merged)

- Character Sheet with custom resources, Ability Library, forms/portraits/equipment profiles and Status Effects; character Battlemap, offline DM Room and same-browser Player Preview.
- Shared deterministic combat and offline encounter commands; shared DM/sheet movement routes, side-aware occupancy, and DM warnings when imported temporary character buffs cannot be tracked.
- Optional AP and resource costs when entering forms, free-to-Base and linked portrait switching.
- Supabase Auth and owner-only **manual** private cloud character Save/Restore across devices. No live multiplayer session.
- GitHub CI with Node tests, Playwright browser interactions and 390px layout checks.
- **PR #35 merged:** first pure `WBCharacter.derive/apply` resource-command slice, resource UI migration, and boosted resource-current preservation across reload. AP/Mana derivation, payment primitives and manual corrections now share the command boundary; runtime ability/form transactions are implemented; Health actions/corrections are implemented; broader lifecycle/undo work remains.

## Character sheet first

Finish the player character sheet before expanding battlemap, DM, PvP or live-session features. Keep their shared rules and save boundaries compatible; maintain regression coverage for the existing views.

Delivery sequence:
- Phone Overview and navigation: Health, AP/reactions and current-form favorite abilities first; file actions in Character menu, reset separated, profile details still editable.
- Implemented: B1/B2 shared AP/Mana commands, atomic ability/form payments and optional ability AP stat discounts with matching display/filter/payment prices.
- Implemented: optional attack/damage rolls and save DCs on ability cards and favorites. Attack, damage bonus, AP-discount, save-DC and target-save stats are independent; shared popup/gear effects/critical math and one activation payment. Wonder/Defy Fate do not apply to attacks. A dedicated Spell type and magic-table defaults remain deferred ability work.
- Implemented: explicit character combat mode, custom ability reset periods, separate combat/outside allowances and combat-aware Parry. StartCombat is idempotent while active; EndCombat refills nothing. Implemented: seven non-weapon milestone action buttons with AP/use tracking, a WIS check for Eyes of Truth, and target save instructions for Commanding Presence. Implemented: Titan's Might melee-hit prompt and Singularity on one chosen weapon hand, with shared counters, atomic attack payment and source snapshots. Implemented: Forge outside-limit settings and shared equipment charge tracking, preserving legacy defaults, edited-row counts and hidden item balances. Narrative outcomes remain table judgments.
- Implemented: character Notes with session notes, backstory, personality, languages and allies/connections, preserved across local/v1/manual-cloud saves and phone navigation.
- Implemented: separate consumable inventory with editable quantities, validated optional healing rolls, explicit own-character healing and character-wide persistence.
- Implemented: a free dice box and the newest 20 timestamped roll results, saved with the character; history details cannot replay costs or effects.
- Implemented: shared Health damage/healing/correction, stability, Trauma and treatment commands with existing recovery/death rules, source-derived values and read-only rendering.
- Implemented: atomic turn/long-rest orchestration with existing timing, source-derived maxima and scoped rest Undo.
- Implemented: shared manual runtime tracker corrections, effect ending, current-stat rules/save migration, weapon properties, armor classes, scaled dice, condition presets, table equipment, inventory and explicit recovery/item actions.
- Next: real-phone rules playtesting and broader transaction Undo. Currency, Temporary Health, innate defenses, exhaustion require any missing setting/rule decisions first. AP growth is now confirmed in CONTEXT.

Keep each stage in a separate reviewable PR; do not implement unapproved mechanics or automatic multiplayer as part of the sheet work.

## Save safety and release follow-up

- **Phone backups:** keep JSON export/cloud-save guidance visible. A manifest, Home Screen instructions, a user-initiated persistent-storage request and per-character backup status deserve a separate mobile UX change. Browser storage and Home Screen installation are not guaranteed backups; test on real Safari before making retention promises.
- **Forward compatibility:** preserve unsupported item/bonus/effect data or guard newer saves before adding schema targets in B3. Current malformed-save recovery does not solve every older-code/newer-data case.
- **Cloud operations:** verify private-group sign-up/SMTP settings and two-user RLS on an isolated project; do not change production Auth or run production migrations during a code review. The new document-size constraint must be deployed through the normal migration workflow; existing oversized rows must be reduced before validating it.
- **PR #36:** retain the eight unmerged commits for review. Its form-effects/overflow work belongs after B1/B2 and DM decisions; do not merge its claimed decisions into this plan or close/delete unmerged work without an agreed disposition. Git refs alone do not prove which PRs are currently open.
- **Rules/docs outside this repo:** the supplied Notion export confirms fixed 5 AP Command, Block scaling through 20 and Two-handed armor reduction. The DM's direct answers override stale Burning/Mana wording. See CONTEXT for the remaining decisions.
- **Maintenance:** replace source-text assertions with behavioral checks as the corresponding modules change, share the remaining hit-die/DM derivation formulas during B1/B2, and review merged branches for cleanup once PR status is available. Do not remove unmerged branches or raise AP/map/token limits without a concrete supported use case.

## Development queue — one narrow Codex PR per task

1. **B1 — Implemented:** pure AP/Mana derivation, shared payment/correction commands, Command-first spending and source-profile form payments, with Node and phone interaction checks. Full character transactions remain B2 work.
2. **B2 — Ability/form slice implemented:** runtime activations and form/portrait selection atomically commit costs, uses/capacity, cooldown/duration and gear/portrait changes. Health actions/corrections are implemented; atomic turn/rest and selective rest Undo are implemented; manual tracker controls are migrated; broader transaction-level Undo remains a follow-up; optional ability AP discounts now share this transaction path.
3. **Current sheet rules — implemented:** current-stat pool maxima and migration, Evasion 12, AP scaling, all non-AGL AP discounts, normal Commanding Presence DC, Titan's Might, weapon properties/range/Loading, armor/Block/scaled dice, table presets, explicit item/recovery/status actions and runtime corrections. Narrative target effects and automatic periodic status enforcement remain separate; all new decisions are in CONTEXT.
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

## Unresolved gameplay rules

Current AP growth, Block scaling through 20, weapon property rules, Heavy double damage modifier, Two-handed Armor Rating reduction and action tiers are specified in CONTEXT. AP continues after 20; other above-20 tables await a separate decision. Remaining resource overflow, automation, Currency, Temporary Health and exhaustion choices are independent of this rules migration.
