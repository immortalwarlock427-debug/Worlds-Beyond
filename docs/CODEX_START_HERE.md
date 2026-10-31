# Codex — Start Here

**Working repository:** `immortalwarlock427-debug/Worlds-Beyond`. Read [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md), [CONTEXT.md](CONTEXT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), and root [AGENTS.md](../AGENTS.md) first.

## Current state (verified)

- PR #35 is **merged**. `js/character-core.js` contains pure, deterministic resource/AP/Mana primitives plus atomic `ActivateAbility`, `EnterForm` and `SelectPortrait` commands. Use buttons, form selectors and portrait selection publish complete command patches, retaining the existing rules. The active +100 max effect 150/200 reload problem has a regression test.
- **Not implemented:** a single command path for all character state; form `effects`; configurable overcharge/hard caps; automatic/manual rules; trigger queue/editor/log; live session multiplayer.
- Existing optional form-entry costs (AP, Mana/Holy Power or custom resource) and linked portrait/form gear changes **must be preserved**.
- Ability AP discounts (None/STR/DEX/INT/FTH, None default) are **implemented** through shared pricing and the atomic activation command. Cards, favorites, readiness, AP bands and sorting agree; base prices remain saved separately.
- Optional ability-card attack/damage rolls and save DCs are **implemented**. `ActivateAbility` validates the setup and returns a pre-activation `rollPlan` on success; `app.js` draws dice and uses the existing popup. Attack, damage bonus, AP discount, save DC and target-save stats stay independent. No Wonder/Defy Fate on attacks.
- Explicit combat mode and custom rest/combat/round use periods are **implemented**, with separate outside allowances (DM confirmed). `StartCombat` / `EndCombat` / `AdvanceAbilityTurn` / `RestAbilities` are pure commands; Parry follows the shared DEX outside allowance. Legacy equipment per-round abilities still need outside-limit configuration.
- Do not assume the DM has answered Rage overflow/excess/typed-correction/automatic entry-cost choices.

## Your next independent task — milestone actions and use tracking

**Scope:** continue finishing the character sheet. Turn the remaining milestone tooltip descriptions into usable actions and counters in a focused slice, reusing existing character payments, roll popup, combat mode and allowance derivation. Keep narrative outcomes at the table. Read the current tooltip/rule text before choosing which milestone actions form one reviewable change.

**Confirmed reset rules:** combat and outside allowances are separate. New combat restores combat/round uses; Start my turn restores round uses only in combat; End combat refills nothing; long rest restores outside allowances. Do not create mode changes during load/render, auto-refill outside uses when entering combat, or refill AP/resources on combat transitions. The modifier used for an outside allowance is independent of attack, damage, discount and save stats. Keep spent counts when maxima change.

**Preserve:**
- The shared `WBAbilities.usageState` model, legacy long-rest defaults, current-allowance manual corrections, idempotent StartCombat, Parry's separate outside count and long-rest Undo. Legacy per-round equipment abilities need explicit outside-limit metadata; do not guess the associated stat for existing items.
- Existing turn/rest processing order, form/portrait/gear alignment, hidden pools, source-profile Mana, active effects and v1 saves. Full Health/turn/rest/Undo command orchestration remains a focused B2 follow-up.
- Atomic ability payments, Command-first AP, independent AP-discount/attack/damage/save fields, pre-activation roll snapshots and UI-only dice. No Wonder/Defy Fate on attack rolls. Save targets resolve outcomes at the table.
- Pure command/state tests plus actual 390px interactions, reload/import/export/cloud copies and existing DM regression coverage. Do not introduce resource-overflow defaults, automatic triggers, multiplayer or a separate spell system in this slice.

## Work protocol

1. Fetch latest `main` and inspect open PRs before creating `codex/<task>`.
2. Read the real modules and tests; propose the smallest safe change. If this work reveals a conflict with established rules, explain the alternatives rather than inventing new rules.
3. Implement the approved milestone slice, add pure tests + at least one relevant Playwright interaction, and run CI. Update docs where status changes.
4. Open one PR with intent, technical boundaries, tests and manual preview instructions. **Do not merge until the DM approves.**
5. Wait for DM to test/merge before starting the next dependent slice.

## Architectural review checklist

The hard parts to protect are: old character saves; no silent truncation of boosted resources; derived numbers independent of the DOM; no duplicate payment paths; form/portrait/worn-gear alignment; stable deterministic events for future multiplayer; safe schema migration; preserving players' ability to edit homebrew numbers freely.

The remaining tasks are in the Delivery section of [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md). The DM will decide unresolved Rage design choices before B3. If you encounter an unknown choice, document it in your PR instead of guessing.
