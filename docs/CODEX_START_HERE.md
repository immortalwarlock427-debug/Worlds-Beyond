# Codex — Start Here

**Working repository:** `immortalwarlock427-debug/Worlds-Beyond`. Read [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md), [CONTEXT.md](CONTEXT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), and root [AGENTS.md](../AGENTS.md) first.

## Current state (verified)

- PR #35 is **merged**. `js/character-core.js` contains pure, deterministic resource/AP/Mana primitives plus atomic `ActivateAbility`, `EnterForm` and `SelectPortrait` commands. Use buttons, form selectors and portrait selection publish complete command patches, retaining the existing rules. The active +100 max effect 150/200 reload problem has a regression test.
- **Not implemented:** a single command path for all character state; form `effects`; configurable overcharge/hard caps; automatic/manual rules; trigger queue/editor/log; live session multiplayer.
- Existing optional form-entry costs (AP, Mana/Holy Power or custom resource) and linked portrait/form gear changes **must be preserved**.
- Ability AP discounts (None/STR/DEX/INT/FTH, None default) are **implemented** through shared pricing and the atomic activation command. Cards, favorites, readiness, AP bands and sorting agree; base prices remain saved separately.
- Optional ability-card attack/damage rolls and save DCs are **implemented**. `ActivateAbility` validates the setup and returns a pre-activation `rollPlan` on success; `app.js` draws dice and uses the existing popup. Attack, damage bonus, AP discount, save DC and target-save stats stay independent. No Wonder/Defy Fate on attacks.
- Explicit combat mode and custom rest/combat/round use periods are **implemented**, with separate outside allowances (DM confirmed). `StartCombat` / `EndCombat` / `AdvanceAbilityTurn` / `RestAbilities` are pure commands; Parry follows the shared DEX outside allowance. Equipment abilities now have explicit outside-limit configuration; definitions without it retain legacy turn resets.
- Seven non-weapon milestone actions are **implemented** under Abilities → Milestone actions. `UseMilestone` adapts to the existing activation transaction; `milestoneUses` keeps separate scoped counts, `SetMilestoneUses` corrects the current allowance, and long-rest Undo includes the map. Eyes of Truth is a WIS check; Commanding Presence is target CHA DC 10 + 2 × mod. Narrative outcomes remain at the table.
- Devastate/Singularity are **implemented**. Confirmed: Devastate applies only to STR-based damage; dual Singularity affects **one chosen hand**. `BeginWeaponAttack` atomically commits AP/reaction and Singularity, returning source snapshots; `ApplyDevastate` consumes its shared use without rerolling damage. A forced critical is distinct from natural 20.
- Equipment Use/corrections and turn/rest resets now use shared allowance helpers/commands. `outsideUsesStat` is optional on item abilities; legacy missing metadata keeps turn resets. Fixed/stat-based outside limits spend `equipmentOutsideSpent` separately from `spent`. Forge remapping preserves counts across edits/removals and current-bank changes; long-rest Undo includes both.
- Character notes are **implemented** in the Notes tab: session notes, backstory, personality, languages and allies/connections use optional plain-text `state.fields` entries. They persist through local/v1/manual-cloud saves and stay shared across forms/rests. Narrative input skips gameplay refresh/commands; character replacement clears absent note fields.
- Consumables are **implemented** under Equipment: separate character-wide stock, Add/Edit/Remove/Use and quantity corrections through `WBCharacter`. Complete roll validation precedes consumption; optional UI healing reuses the existing Health rules once. No inferred AP price, replenishment on rests/forms or other-character writes. Definitions and unknown fields survive local/v1/manual-cloud saves; edits preserve current quantities.
- Free dice/recent rolls are **implemented** in Dice. Complete free-expression validation uses the existing roll adapter; RecordRoll/ReviseRoll/ClearRollHistory write only bounded primitive metadata and emit no gameplay events. Actual rolls capture without extra dice RNG; Wonder creates a result, while Devastate/Defy Fate/opportunity conversion revise the original id/time. Read-only details never invoke the popup or replay effects. Local/v1/manual-cloud saves retain the newest 20; legacy/reset/import behavior and unsupported-data guards are covered.
- Shared Health is **implemented**: state-derived maximum/current/threshold/flags and typed damage, healing, manual current/max, stability, Trauma and treatment commands. Ordinary/potion healing share recovery/cap math. Metadata hydration is pure and applied at load/save, not rendering; no gameplay events or Trauma occur from repaint/configuration. Historical gear numbers are read consistently. Atomic turn/rest and scoped rest Undo are also implemented.
- Do not assume the DM has answered Rage overflow/excess/typed-correction/automatic entry-cost choices.

## Your next independent task — manual runtime tracker controls

**Scope:** migrate remaining manual runtime tracker corrections and effect-ending controls to the shared character command boundary: custom ability uses/cooldown/duration/held capacity, Wonder/reactions and existing end-effect actions. Reuse current helpers and manual editing rules without introducing costs, auto triggers or new restrictions. Keep configuration editors separate. Atomic StartTurn/LongRest/UndoLongRest are implemented; preserve their ordering, scoped receipt and legacy resource policies. Broader transaction-history Undo and unapproved B3 resource choices remain separate.

**Preserve:**
- Atomic turn/rest failure rollback, regeneration before timer expiry/max reconciliation, statuses before bleeding, one bleed, state-derived refill and selective rest Undo. No consumable refills, lost later notes/history/stock/status edits or persisted Undo receipts.
- Shared Health derivation/commands, signed/full sentinels, history-based maxima, current VIT/gear/form effects, Death's Mercy, recovery Trauma, manual corrections and metadata-only flag hydration. No rendering-side Health writes or extra healing applications.
- Free-dice validation, actual-roll capture without extra RNG, bounded primitive history, id/time-preserving revisions, read-only details and character-only persistence. Viewing history must never trigger Health actions.
- Consumable quantity/definition commands, current-count edits, optional healing and single-application results, no rest/form refills, unknown metadata and manual corrections.
- Notes fields and exact multiline text, narrative-only editing, legacy empty defaults and character replacement/reset behavior.
- Equipment charge tracking and explicit outside-use choices. Missing metadata keeps legacy turn resets; do not infer an item ability stat. Keep both spent maps, Forge row remapping, current-bank manual corrections, hidden item balances and long-rest Undo.
- Confirmed weapon milestones, actual natural dice, source damage snapshots, atomic AP/reaction + Singularity payment, one-hit Devastate and existing opportunity conversion.
- All other milestone/custom ability flows, separate combat/outside allowances, idempotent StartCombat, combat-only scoped round refills and no refill on EndCombat.
- Source-profile Mana, independent ability roll fields, UI-only dice, form/portrait/gear alignment, cloud revision receipts, stale-tab save protection and independent DM saves.
- Relevant 390px browser interactions and existing regressions. Broader transaction Undo remains a subsequent focused slice; do not introduce unapproved game rules, automatic triggers or multiplayer.

## Work protocol

1. Fetch latest `main` and inspect open PRs before creating `codex/<task>`.
2. Read the real modules and tests; propose the smallest safe change. If this work reveals a conflict with established rules, explain the alternatives rather than inventing new rules.
3. Implement manual tracker commands with deterministic correction/event checks and real phone/effect-ending/rest-Undo interactions, then run the regression checks and CI. Update docs where status changes.
4. Open one PR with intent, technical boundaries, tests and manual preview instructions. **Do not merge until the DM approves.**
5. Wait for DM to test/merge before starting the next dependent slice.

## Architectural review checklist

The hard parts to protect are: old character saves; no silent truncation of boosted resources; derived numbers independent of the DOM; no duplicate payment paths; form/portrait/worn-gear alignment; stable deterministic events for future multiplayer; safe schema migration; preserving players' ability to edit homebrew numbers freely.

The remaining tasks are in the Delivery section of [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md). The DM will decide unresolved Rage design choices before B3. If you encounter an unknown choice, document it in your PR instead of guessing.
