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
- Do not assume the DM has answered Rage overflow/excess/typed-correction/automatic entry-cost choices.

## Your next independent task — Devastate and Singularity weapon rolls

**Scope:** finish the weapon-affecting milestone actions using existing attack/damage popups, shared rules and milestone-use commands. Keep Devastate/Singularity counts in the same milestone model instead of independent flags. Preserve weapon AP, opportunity attacks, advantage/disadvantage, dice maximum + rolled dice criticals and off-hand half damage.

**Resolve genuine rule ambiguities before coding:** Devastate says to add the STR modifier twice instead of once; confirm how it applies to attacks whose damage normally uses DEX. Singularity says a weapon attack becomes critical on a hit; confirm which hand(s) it covers during a dual attack. Clarify any analogous unsupported custom ability interaction instead of silently applying weapon-only wording to every ability. A forced critical is distinct from a natural 20 and must not automatically gain natural-20-only Dodge immunity.

**Preserve:**
- The seven existing manual milestone actions and shared descriptions, effective-score unlocks, fixed-five-AP costs, current-modifier plans, narrative/target-save boundaries, manual corrections, export/reload/cloud copies and long-rest Undo.
- Separate combat/outside allowances, idempotent StartCombat, turn-only round resets in combat, no refill on EndCombat, spent counts retained as maxima/unlocks change, and Parry's existing integration.
- Atomic activation/payment rejection, Command-first AP, independent AP-discount/attack/damage/save fields, pre-activation roll snapshots and UI-only dice. No Wonder/Defy Fate on attack rolls.
- Existing turn/rest order, form/portrait/gear alignment, resource maxima and independent DM saves. Full Health/turn/rest/Undo command orchestration and legacy equipment outside-limit metadata remain follow-ups.
- Pure command/state tests and actual 390px weapon interactions. Do not invent balance rules, resource-overflow defaults, automatic triggers or multiplayer.

## Work protocol

1. Fetch latest `main` and inspect open PRs before creating `codex/<task>`.
2. Read the real modules and tests; propose the smallest safe change. If this work reveals a conflict with established rules, explain the alternatives rather than inventing new rules.
3. Implement the approved weapon-milestone slice, add pure tests + at least one relevant Playwright interaction, and run CI. Update docs where status changes.
4. Open one PR with intent, technical boundaries, tests and manual preview instructions. **Do not merge until the DM approves.**
5. Wait for DM to test/merge before starting the next dependent slice.

## Architectural review checklist

The hard parts to protect are: old character saves; no silent truncation of boosted resources; derived numbers independent of the DOM; no duplicate payment paths; form/portrait/worn-gear alignment; stable deterministic events for future multiplayer; safe schema migration; preserving players' ability to edit homebrew numbers freely.

The remaining tasks are in the Delivery section of [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md). The DM will decide unresolved Rage design choices before B3. If you encounter an unknown choice, document it in your PR instead of guessing.
