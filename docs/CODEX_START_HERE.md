# Codex — Start Here

**Working repository:** `immortalwarlock427-debug/Worlds-Beyond`. Read [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md), [CONTEXT.md](CONTEXT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md), and root [AGENTS.md](../AGENTS.md) first.

## Current state

The Oct 31 rules handoff is implemented in the current branch: shared current-stat Health/Mana/Evasion/AP, one-time v1 save migration, Titan's Might, property-driven weapon/armor/Block/scaling rules, exact Notion milestone/condition text and 70 equipment presets. Current pool values move with maxima on real changes; migrated old saves retain their initial currents. Explicit Draw/Reload/Drink, Shake It Off, short-rest healing, condition presets, inventory slots and manual runtime tracker commands are present. Preserve atomic turns/rests, scoped rest Undo, separate combat/outside counters, read-only roll history and independent character/game saves.

## Remaining work

Verify on real phones and review the large rule migration before new features. Broader transaction Undo, full periodic status/target enforcement, spells, exhaustion, Currency, Temporary Health, custom-resource overflow and live multiplayer remain separate. Only AP was approved to scale beyond 20; other supplied dice tables retain their last tier. Burning DC 12 is an editable default; no daily short-rest allowance is invented. The uploaded Notion export plus the user's direct answers are the rule sources. PR #36 remains untouched.

## Work protocol

1. Fetch latest `main` and inspect open PRs before creating `codex/<task>`.
2. Read the real modules and tests; propose the smallest safe change. If this work reveals a conflict with established rules, explain the alternatives rather than inventing new rules.
3. Preserve the verified rules and save migration; make the next focused change with behavioral and phone regression checks and CI. Update docs where status changes.
4. Open one PR with intent, technical boundaries, tests and manual preview instructions. **Do not merge until the DM approves.**
5. Wait for DM to test/merge before starting the next dependent slice.

## Architectural review checklist

The hard parts to protect are: old character saves; no silent truncation of boosted resources; derived numbers independent of the DOM; no duplicate payment paths; form/portrait/worn-gear alignment; stable deterministic events for future multiplayer; safe schema migration; preserving players' ability to edit homebrew numbers freely.

The remaining tasks are in the Delivery section of [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md). The DM will decide unresolved Rage design choices before B3. If you encounter an unknown choice, document it in your PR instead of guessing.
