# Codex — Start Here

**Working repository:** `immortalwarlock427-debug/Worlds-Beyond`. Read [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md), [CONTEXT.md](CONTEXT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), and root [AGENTS.md](../AGENTS.md) first.

## Current state (verified)

- PR #35 is **merged**. `js/character-core.js` exists and contains pure, deterministic **custom resource** `derive/apply` only. The real resource UI uses it. The active +100 max effect 150/200 reload problem has a regression test.
- **Not implemented:** a single command path for all character state; form `effects`; configurable overcharge/hard caps; automatic/manual rules; trigger queue/editor/log; live session multiplayer.
- Existing optional form-entry costs (AP, Mana/Holy Power or custom resource) and linked portrait/form gear changes **must be preserved**.
- Current ability AP discounts (by STR/DEX/INT/FTH) are **planned, not implemented**.
- Do not assume the DM has answered Rage overflow/excess/typed-correction/automatic entry-cost choices.

## Your next independent coding task — B1

**Title suggestion:** `Codex: Derive and migrate character AP/Mana through pure commands`

**Scope:** strengthen `WBCharacter.derive/apply` so AP and built-in Mana/Holy Power are read and mutated through a tested pure contract. Derivation must not use `document`, DOM inputs, localStorage or rendering. Investigate actual field names, default/null AP behavior, maximum calculation, Command-granted AP spending priority, Mana visibility/form rules and manual overrides **before coding**. Keep the original game rules exactly the same. Prefer migrating one related group of existing buttons/callbacks rather than rewriting the sheet.

**Important tests / behavior:**
- A blank/full AP tracker remains full, and Command-granted AP is spent in the existing order; AP cannot be accidentally created by a form/ability action.
- Built-in Mana/Holy Power availability is form-aware without erasing a hidden pool; manual corrections remain possible.
- Insufficient AP or Mana rejects the command with no partially mutated state.
- Preserve character export/import, cloud copy compatibility, timed abilities, form entry-cost validation and linked portraits.
- Tests prove command purity, exact math and user-click behavior at 390px. Check the existing CI and browser suite.
- **Do not implement** actual automatic triggers, overcharge settings, new forms/effects, DM multiplayer or redesign the ability library in B1. If a combined AP + resource transaction cannot safely be covered in B1, identify and schedule its migration in B2 rather than introducing a parallel partial-payment path.

## Work protocol

1. Fetch latest `main` and inspect open PRs before creating `codex/<task>`.
2. Read the real modules and tests; propose the smallest safe change. If B1 reveals a conflict with established rules, explain the alternatives rather than inventing new rules.
3. Implement B1, add pure tests + at least one relevant Playwright interaction, and run CI. Update docs where status changes.
4. Open one PR with intent, technical boundaries, tests and manual preview instructions. **Do not merge until the DM approves.**
5. Wait for DM to test/merge before moving to B2 or the next independent task.

## Architectural review checklist

The hard parts to protect are: old character saves; no silent truncation of boosted resources; derived numbers independent of the DOM; no duplicate payment paths; form/portrait/worn-gear alignment; stable deterministic events for future multiplayer; safe schema migration; preserving players' ability to edit homebrew numbers freely.

After B1, the next tasks are in the Delivery section of [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md). The DM will decide unresolved Rage design choices before B3. If you encounter an unknown choice, document it in your PR instead of guessing.
