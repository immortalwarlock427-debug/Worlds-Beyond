# Codex — Start Here

**Working repository:** `immortalwarlock427-debug/Worlds-Beyond`. Read [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md), [CONTEXT.md](CONTEXT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), and root [AGENTS.md](../AGENTS.md) first.

## Current state (verified)

- PR #35 is **merged**. `js/character-core.js` contains pure, deterministic resource/AP/Mana primitives plus atomic `ActivateAbility`, `EnterForm` and `SelectPortrait` commands. Use buttons, form selectors and portrait selection publish complete command patches, retaining the existing rules. The active +100 max effect 150/200 reload problem has a regression test.
- **Not implemented:** a single command path for all character state; form `effects`; configurable overcharge/hard caps; automatic/manual rules; trigger queue/editor/log; live session multiplayer.
- Existing optional form-entry costs (AP, Mana/Holy Power or custom resource) and linked portrait/form gear changes **must be preserved**.
- Ability AP discounts (None/STR/DEX/INT/FTH, None default) are **implemented** through shared pricing and the atomic activation command. Cards, favorites, readiness, AP bands and sorting agree; base prices remain saved separately.
- Optional ability-card attack/damage rolls and save DCs are **implemented**. `ActivateAbility` validates the setup and returns a pre-activation `rollPlan` on success; `app.js` draws dice and uses the existing popup. Attack, damage bonus, AP discount, save DC and target-save stats stay independent. No Wonder/Defy Fate on attacks.
- Explicit combat mode and custom rest/combat/round use periods are **implemented**, with separate outside allowances (DM confirmed). `StartCombat` / `EndCombat` / `AdvanceAbilityTurn` / `RestAbilities` are pure commands; Parry follows the shared DEX outside allowance. Legacy equipment per-round abilities still need outside-limit configuration.
- Seven non-weapon milestone actions are **implemented** under Abilities → Milestone actions. `UseMilestone` adapts to the existing activation transaction; `milestoneUses` keeps separate scoped counts, `SetMilestoneUses` corrects the current allowance, and long-rest Undo includes the map. Eyes of Truth is a WIS check; Commanding Presence is target CHA DC 10 + 2 × mod. Narrative outcomes remain at the table.
- Devastate/Singularity are **implemented**. Confirmed: Devastate applies only to STR-based damage; dual Singularity affects **one chosen hand**. `BeginWeaponAttack` atomically commits AP/reaction and Singularity, returning source snapshots; `ApplyDevastate` consumes its shared use without rerolling damage. A forced critical is distinct from natural 20.
- Do not assume the DM has answered Rage overflow/excess/typed-correction/automatic entry-cost choices.

## Your next independent task — equipment ability outside-use tracking

**Scope:** continue finishing character abilities. Add explicit outside-use settings for legacy equipment abilities that currently reset every round, reusing the same combat/outside allowance derivation and command boundaries as custom abilities/milestones. Inspect Forge editing, equipped ability Use, `state.spent`, turn/rest processing and long-rest Undo first.

**Compatibility:** existing item abilities contain a uses count and round/rest period but no associated outside stat. Do not infer it from a weapon stat or invent a class rule. Make that stat/fixed-limit choice explicit in the editor, preserve old item definitions and stored spends, and resolve any genuine migration/reset ambiguity before changing legacy behavior. Hidden/unequipped items and alternate worn profiles must retain their balances. Keep manual corrections available.

**Preserve:**
- Confirmed weapon milestone rules: STR-based damage only for Devastate; one chosen hand for dual Singularity; declared use spent on a miss; no natural-20-only immunity on forced criticals. Keep original damage snapshots, recomputation before zero clamps/halving, normal critical dice and opportunity/AP conversion behavior.
- All milestone actions and counts, fixed AP payments, current-modifier plans, narrative/target-save boundaries, export/reload/cloud copies and long-rest Undo.
- Separate combat/outside allowances, idempotent StartCombat, combat-only round refills, no refill on EndCombat and spent counts retained as maxima/unlocks change.
- Atomic rejection, Command-first AP, source-profile Mana, independent ability roll fields, UI-only dice, form/portrait/gear alignment and independent DM saves. No Wonder/Defy Fate on attacks.
- Pure command/state tests and actual 390px interactions. Full Health/turn/rest/Undo orchestration remains a focused B2 follow-up; do not introduce automatic triggers, unapproved resource overflow or multiplayer.

## Work protocol

1. Fetch latest `main` and inspect open PRs before creating `codex/<task>`.
2. Read the real modules and tests; propose the smallest safe change. If this work reveals a conflict with established rules, explain the alternatives rather than inventing new rules.
3. Implement the approved equipment-use slice, add pure tests + at least one relevant Playwright interaction, and run CI. Update docs where status changes.
4. Open one PR with intent, technical boundaries, tests and manual preview instructions. **Do not merge until the DM approves.**
5. Wait for DM to test/merge before starting the next dependent slice.

## Architectural review checklist

The hard parts to protect are: old character saves; no silent truncation of boosted resources; derived numbers independent of the DOM; no duplicate payment paths; form/portrait/worn-gear alignment; stable deterministic events for future multiplayer; safe schema migration; preserving players' ability to edit homebrew numbers freely.

The remaining tasks are in the Delivery section of [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md). The DM will decide unresolved Rage design choices before B3. If you encounter an unknown choice, document it in your PR instead of guessing.
