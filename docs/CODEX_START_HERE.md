# Codex — Start Here

**Working repository:** `immortalwarlock427-debug/Worlds-Beyond`. Read [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md), [CONTEXT.md](CONTEXT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), and root [AGENTS.md](../AGENTS.md) first.

## Current state (verified)

- PR #35 is **merged**. `js/character-core.js` contains pure, deterministic resource and AP/Mana derivation/payment commands. The resource UI and AP/Mana payment/correction hooks use them. The active +100 max effect 150/200 reload problem has a regression test.
- **Not implemented:** a single command path for all character state; form `effects`; configurable overcharge/hard caps; automatic/manual rules; trigger queue/editor/log; live session multiplayer.
- Existing optional form-entry costs (AP, Mana/Holy Power or custom resource) and linked portrait/form gear changes **must be preserved**.
- Current ability AP discounts (by STR/DEX/INT/FTH) are **planned, not implemented**.
- Do not assume the DM has answered Rage overflow/excess/typed-correction/automatic entry-cost choices.

## Your next independent coding task — B2: ability/form transactions

**Title suggestion:** `Codex: Apply ability and form changes as atomic character commands`

**Scope:** build on B1's `SpendPools`/AP/Mana primitives, rather than recreating them. Migrate one focused group of ability/form operations into pure commands that atomically cover custom-resource payment, charges, cooldowns/durations and form/portrait/equipment changes. Reuse the existing `WBAbilities` and `WBEquipment` behavior; preserve free-to-Base and same-form selection. Keep the payment anchored to the source gear profile. A failed operation must leave every balance, tracker, form, portrait and worn slot unchanged.

**Important tests / behavior:**
- B1 already covers blank/full trackers, Command-first spending, historical Mana/Holy Power maxima, manual overrides/corrections, hidden balances and rejection of partial AP/Mana payments.
- Extend those checks to combined AP plus custom resources, ability charges/cooldowns/effects and form/portrait/equipment transitions. Validate before changing anything; don't add a second payment formula.
- Keep derive/render/load free from gameplay mutations. Preserve v1 exports, cloud revision receipts, character/game separation and current-form Overview favorites.
- Add pure transaction tests and at least one actual 390px interaction. Retain existing AP/Mana, cloud and phone regressions.
- Keep Health, turn/rest orchestration and transaction-level undo in subsequent focused B2 slices if they cannot fit safely in this change.
- **Do not implement** automation triggers, overcharge defaults, new form effects or DM/multiplayer features. The independent ability-discount feature remains next to this payment work; its stat field must stay separate from attack/DC fields.

## Work protocol

1. Fetch latest `main` and inspect open PRs before creating `codex/<task>`.
2. Read the real modules and tests; propose the smallest safe change. If B2 reveals a conflict with established rules, explain the alternatives rather than inventing new rules.
3. Implement the focused B2 slice, add pure tests + at least one relevant Playwright interaction, and run CI. Update docs where status changes.
4. Open one PR with intent, technical boundaries, tests and manual preview instructions. **Do not merge until the DM approves.**
5. Wait for DM to test/merge before starting the next dependent slice.

## Architectural review checklist

The hard parts to protect are: old character saves; no silent truncation of boosted resources; derived numbers independent of the DOM; no duplicate payment paths; form/portrait/worn-gear alignment; stable deterministic events for future multiplayer; safe schema migration; preserving players' ability to edit homebrew numbers freely.

The remaining tasks are in the Delivery section of [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md). The DM will decide unresolved Rage design choices before B3. If you encounter an unknown choice, document it in your PR instead of guessing.
