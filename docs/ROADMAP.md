# Roadmap

This is a **future-work plan**, not a record of pull requests. For what works today, read [CONTEXT.md](CONTEXT.md); for APIs and persistence, read [ARCHITECTURE.md](ARCHITECTURE.md).

## Current baseline

- GitHub Pages serves the fully featured Character Sheet, custom resources, Ability Library, forms, Status Effects, Battlemap, offline DM Room, and same-browser Player Preview.
- `WBCombat` and `WBEncounter` share deterministic combat logic and revision-checked offline encounter actions. Sheet and DM movement pathfinding now use the same pure route engine.
- Supabase Auth and private character cloud Save/Restore now work across devices. The production site auto-connects through a **public publishable** key. **Cloud saves remain manual**; the DM game is not online.
- The same-browser Player Preview is useful for local testing but **will not be extended as the multiplayer architecture**.

## Ordered priorities — one branch/PR per item

1. **Documentation cleanup (this task):** accurate current capability summary, rule decisions and undecided questions; stop per-PR sections and move engineering detail from AGENTS to ARCHITECTURE.
2. **Browser integration testing:** Playwright in GitHub Actions on every PR. Test custom resources, ability AP/cooldown decrement, timed statuses, multiple forms/gear/resources, export/import, DM import/start/move, and every page at 390px without horizontal scrolling. Discover all tests under `tests/` instead of a fixed list; rename the legacy Resource Manager workflow and remove old triggers.
3. **Unified sheet/DM movement — implemented:** shared pure routing, fog-aware sheet planning, traversable allies/downed actors and legal stopping squares.
4. **DM temporary-effect import safety — implemented:** retain equipment and selected form bonuses; omit active timed ability bonuses and list all active effects and remaining turns as warnings.
5. **Optional form-entry costs — implemented:** AP/resource/both, free by default and free to Base. Linked portrait and ability form switches share validation; unaffordable transitions leave state unchanged.
6. **Stat discounts for custom ability AP:** None/STR/DEX/INT/FTH, pure `WBCombat` formula with half-cost floor; update cards, availability and filters.
7. **Cloud operation and live-session planning only:** confirm player account onboarding/privacy and invitations (disable open signups if appropriate; configure reliable email delivery). Write the in-person DM-computer/phone, player-phone join-code design with secure memberships, redacted views and revision-safe actions. **Await DM approval before implementing actual multiplayer.**

## Later improvements

- More maps, ally tokens, doors and the Barrow puzzle; user-uploaded map images and terrain/light/darkness brushes.
- Richer status presets, consumables, currency, gear sets, custom resource/ability templates and dice animations.
- DM encounter history/export and optional battlemap UI polish.
- Cloud portrait object storage and automatic sync only after safe ownership/conflict design.

## Undecided — do not build

AP growth by level; Block dice scaling by level and shield sizes; two-handed versus dual-wield damage; AP costs for smaller actions; WIS actions; Exhaustion redesign. Proposals in CONTEXT.md are not decisions.
