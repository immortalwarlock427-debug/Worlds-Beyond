# Codex — Start Here

**Working repository:** `immortalwarlock427-debug/Worlds-Beyond`. Read [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md), [CONTEXT.md](CONTEXT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), and root [AGENTS.md](../AGENTS.md) first.

## Current state (verified)

- PR #35 is **merged**. `js/character-core.js` contains pure, deterministic resource/AP/Mana primitives plus atomic `ActivateAbility`, `EnterForm` and `SelectPortrait` commands. Use buttons, form selectors and portrait selection publish complete command patches, retaining the existing rules. The active +100 max effect 150/200 reload problem has a regression test.
- **Not implemented:** a single command path for all character state; form `effects`; configurable overcharge/hard caps; automatic/manual rules; trigger queue/editor/log; live session multiplayer.
- Existing optional form-entry costs (AP, Mana/Holy Power or custom resource) and linked portrait/form gear changes **must be preserved**.
- Ability AP discounts (None/STR/DEX/INT/FTH, None default) are **implemented** through shared pricing and the atomic activation command. Cards, favorites, readiness, AP bands and sorting agree; base prices remain saved separately.
- Optional ability-card attack/damage rolls and save DCs are **implemented**. `ActivateAbility` validates the setup and returns a pre-activation `rollPlan` on success; `app.js` draws dice and uses the existing popup. Attack, damage bonus, AP discount, save DC and target-save stats stay independent. No Wonder/Defy Fate on attacks.
- Do not assume the DM has answered Rage overflow/excess/typed-correction/automatic entry-cost choices.

## Your next independent task — explicit combat/rest lifecycle

**Scope:** continue finishing the character sheet. Work out explicit in-combat/out-of-combat transitions and per-combat/per-round/long-rest use tracking before expanding milestone buttons. Keep offline DM/game saves separate; a local character combat switch is not encounter synchronization.

**Before coding:** inspect the current turn/rest behavior and confirmed milestone rules. Resolve the missing reset semantics with the DM: what starts/ends combat, which counters reset when, how out-of-combat uses work, and how to avoid refilling uses by repeatedly toggling combat. Present the concrete proposed behavior and genuinely unresolved choices before implementing rule-dependent resets. Do not treat previous review suggestions as final rules.

**Preserve:**
- Existing turn/rest processing, form/portrait/gear alignment, hidden pools, source-profile Mana, active effects and v1 saves. Health, broader manual tracker commands and transaction-level Undo remain focused B2 follow-ups.
- The shared optional AP discount and one atomic `ActivateAbility` payment path. Blank/zero remains free, None stays flat, negative modifiers raise price; Command AP is spent first and combined costs reject atomically.
- Ability roll setup validation before payment, the pre-activation stat/gear snapshot returned on success, independent attack/damage/save/discount statistics, UI-only dice and no extra payment for damage follow-ups. Target saves resolve at the table; no new hit/crit/kill triggers.
- Pure command/state tests plus actual 390px interactions, legacy reload/import/export/cloud copies and existing DM regression coverage. Do not introduce resource-overflow defaults, automatic triggers, multiplayer or a separate spell system in this slice.

## Work protocol

1. Fetch latest `main` and inspect open PRs before creating `codex/<task>`.
2. Read the real modules and tests; propose the smallest safe change. If this work reveals a conflict with established rules, explain the alternatives rather than inventing new rules.
3. Implement the approved lifecycle slice, add pure tests + at least one relevant Playwright interaction, and run CI. Update docs where status changes.
4. Open one PR with intent, technical boundaries, tests and manual preview instructions. **Do not merge until the DM approves.**
5. Wait for DM to test/merge before starting the next dependent slice.

## Architectural review checklist

The hard parts to protect are: old character saves; no silent truncation of boosted resources; derived numbers independent of the DOM; no duplicate payment paths; form/portrait/worn-gear alignment; stable deterministic events for future multiplayer; safe schema migration; preserving players' ability to edit homebrew numbers freely.

The remaining tasks are in the Delivery section of [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md). The DM will decide unresolved Rage design choices before B3. If you encounter an unknown choice, document it in your PR instead of guessing.
