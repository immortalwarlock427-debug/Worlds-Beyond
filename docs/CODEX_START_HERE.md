# Codex — Start Here

**Working repository:** `immortalwarlock427-debug/Worlds-Beyond`. Read [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md), [CONTEXT.md](CONTEXT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), and root [AGENTS.md](../AGENTS.md) first.

## Current state (verified)

- PR #35 is **merged**. `js/character-core.js` contains pure, deterministic resource/AP/Mana primitives plus atomic `ActivateAbility`, `EnterForm` and `SelectPortrait` commands. Use buttons, form selectors and portrait selection publish complete command patches, retaining the existing rules. The active +100 max effect 150/200 reload problem has a regression test.
- **Not implemented:** a single command path for all character state; form `effects`; configurable overcharge/hard caps; automatic/manual rules; trigger queue/editor/log; live session multiplayer.
- Existing optional form-entry costs (AP, Mana/Holy Power or custom resource) and linked portrait/form gear changes **must be preserved**.
- Ability AP discounts (None/STR/DEX/INT/FTH, None default) are **implemented** through shared pricing and the atomic activation command. Cards, favorites, readiness, AP bands and sorting agree; base prices remain saved separately.
- Do not assume the DM has answered Rage overflow/excess/typed-correction/automatic entry-cost choices.

## Your next independent task — optional ability-card rolls

**Scope:** continue finishing the character sheet. Add optional attack/damage/save configuration to the existing Ability Library, reusing the weapon roll UI and shared combat rules where applicable. Keep the existing AP-discount stat independent from attack stat, save-DC stat and target-save stat. Blank roll configuration must retain today's cost/tracker-only Use behavior.

**Before coding:** inspect the existing weapon popup, approved attack/check rules and persistence boundaries. Confirm only genuinely missing mechanics or roll/payment semantics with the DM; do not infer new gameplay rules from a review suggestion. Wonder and Defy Fate must not apply to attack rolls. Reuse the existing critical/advantage rules where they apply. Treat spells as an eventual ability type, rather than creating a parallel spell list.

**Preserve:**
- The shared `WBCombat.abilityApCost` formula and `WBAbilities.abilityApCost` state derivation. None stays flat; negative modifiers raise the price; blank/zero remains free. Gear, effects, forms and manual overrides contribute just as they do to current character modifiers.
- One atomic `ActivateAbility` payment path, Command-first AP, combined cost rejection, charges/cooldowns/duration, source-profile Mana, hidden pools and form/portrait/gear alignment.
- Legacy abilities, v1 JSON exports, reload/import/cloud copies, independent DM saves and actual phone usability. New roll fields must survive duplication and round trips.
- Pure tests for any shared rule additions plus relevant 390px browser interactions. Avoid implementing automatic triggers, unapproved resource overflow, new form effects or DM/multiplayer features in this slice.
- Health, turn/rest orchestration, broader manual tracker commands and transaction-level Undo remain focused B2 follow-ups.

## Work protocol

1. Fetch latest `main` and inspect open PRs before creating `codex/<task>`.
2. Read the real modules and tests; propose the smallest safe change. If this work reveals a conflict with established rules, explain the alternatives rather than inventing new rules.
3. Implement the approved ability-roll slice, add pure tests + at least one relevant Playwright interaction, and run CI. Update docs where status changes.
4. Open one PR with intent, technical boundaries, tests and manual preview instructions. **Do not merge until the DM approves.**
5. Wait for DM to test/merge before starting the next dependent slice.

## Architectural review checklist

The hard parts to protect are: old character saves; no silent truncation of boosted resources; derived numbers independent of the DOM; no duplicate payment paths; form/portrait/worn-gear alignment; stable deterministic events for future multiplayer; safe schema migration; preserving players' ability to edit homebrew numbers freely.

The remaining tasks are in the Delivery section of [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md). The DM will decide unresolved Rage design choices before B3. If you encounter an unknown choice, document it in your PR instead of guessing.
