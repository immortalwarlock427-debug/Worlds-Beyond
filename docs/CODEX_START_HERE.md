# Codex — Start Here

**Working repository:** `immortalwarlock427-debug/Worlds-Beyond`. Read [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md), [CONTEXT.md](CONTEXT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), and root [AGENTS.md](../AGENTS.md) first.

## Current state (verified)

- PR #35 is **merged**. `js/character-core.js` contains pure, deterministic resource/AP/Mana primitives plus atomic `ActivateAbility`, `EnterForm` and `SelectPortrait` commands. Use buttons, form selectors and portrait selection publish complete command patches, retaining the existing rules. The active +100 max effect 150/200 reload problem has a regression test.
- **Not implemented:** a single command path for all character state; form `effects`; configurable overcharge/hard caps; automatic/manual rules; trigger queue/editor/log; live session multiplayer.
- Existing optional form-entry costs (AP, Mana/Holy Power or custom resource) and linked portrait/form gear changes **must be preserved**.
- Current ability AP discounts (by STR/DEX/INT/FTH) are **planned, not implemented**.
- Do not assume the DM has answered Rage overflow/excess/typed-correction/automatic entry-cost choices.

## Your next independent coding task — ability AP discounts

**Title suggestion:** `Codex: Apply stat discounts consistently to custom ability AP costs`

**Scope:** add the already-approved optional `Discounted by: None / STR / DEX / INT / FTH` field to abilities, default None. Put the shared math in `WBCombat`: `max(ceil(base AP / 2), base AP − current effective modifier)`; negative modifiers raise cost. None keeps the existing flat cost. Use the same derived price for transaction validation/payment, library/Overview badges, Usable now, AP filters and sorting. Keep this field independent from future attack/DC statistics.

**Important tests / behavior:**
- Build on the B1 pool primitives and B2 `ActivateAbility` transaction. Do not introduce another payment path or duplicate the discount formula in UI handlers.
- Include worn gear, active ability effects, current-form stat bonuses and manual modifier overrides exactly as current character modifiers do. Zero/blank base cost stays free; old abilities retain flat prices by default.
- Preserve Command-first payment, atomic rejection, charges/cooldowns/duration, hidden pools, free Base/same-form selection, gear/portrait alignment and source-profile Mana costs.
- Pure tests must cover the half-cost ceiling, negative modifiers, defaults, live modifier changes and rejected combined costs. Actual 390px tests must prove card/favorite display, filters and the charged amount agree, including export/reload.
- Do not add spells, attack/damage rolls, automatic triggers, overcharge defaults, new form effects or DM/multiplayer features in this change.
- Health, turn/rest orchestration, broader manual tracker commands and transaction-level Undo remain focused B2 follow-ups. They do not block this independent, already-decided discount feature.

## Work protocol

1. Fetch latest `main` and inspect open PRs before creating `codex/<task>`.
2. Read the real modules and tests; propose the smallest safe change. If this work reveals a conflict with established rules, explain the alternatives rather than inventing new rules.
3. Implement the discount feature, add pure tests + at least one relevant Playwright interaction, and run CI. Update docs where status changes.
4. Open one PR with intent, technical boundaries, tests and manual preview instructions. **Do not merge until the DM approves.**
5. Wait for DM to test/merge before starting the next dependent slice.

## Architectural review checklist

The hard parts to protect are: old character saves; no silent truncation of boosted resources; derived numbers independent of the DOM; no duplicate payment paths; form/portrait/worn-gear alignment; stable deterministic events for future multiplayer; safe schema migration; preserving players' ability to edit homebrew numbers freely.

The remaining tasks are in the Delivery section of [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md). The DM will decide unresolved Rage design choices before B3. If you encounter an unknown choice, document it in your PR instead of guessing.
