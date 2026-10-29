# Roadmap

This is a **future-work plan**, not a record of pull requests. For what works today, read [CONTEXT.md](CONTEXT.md); for APIs and persistence, read [ARCHITECTURE.md](ARCHITECTURE.md).

## Current baseline

- GitHub Pages serves the fully featured Character Sheet, custom resources, Ability Library, forms, Status Effects, Battlemap, offline DM Room, and same-browser Player Preview.
- `WBCombat` and `WBEncounter` share deterministic combat logic and revision-checked offline encounter actions. Sheet and DM movement pathfinding still differ.
- Supabase Auth and private character cloud Save/Restore now work across devices. The production site auto-connects through a **public publishable** key. **Cloud saves remain manual**; the DM game is not online.
- The same-browser Player Preview is useful for local testing but **will not be extended as the multiplayer architecture**.

## Ordered priorities — one branch/PR per item

1. **Documentation cleanup (this task):** accurate current capability summary, rule decisions and undecided questions; stop per-PR sections and move engineering detail from AGENTS to ARCHITECTURE.
2. **Browser integration testing:** Playwright in GitHub Actions on every PR. Test custom resources, ability AP/cooldown decrement, timed statuses, multiple forms/gear/resources, export/import, DM import/start/move, and every page at 390px without horizontal scrolling. Discover all tests under `tests/` instead of a fixed list; rename the legacy Resource Manager workflow and remove old triggers.
3. **Unified sheet/DM movement:** one pure pathfinder, retaining sheet fog and discovery behavior; allies/downed creatures can be passed through but not stopped upon; standing enemies obstruct. DM actors need editable Party/Enemy sides with sensible defaults. Keep eight directions.
4. **Fix DM temporary-effect imports:** only permanent equipment/current form bonuses enter the snapshot; list omitted timed buffs and remaining turns as warnings.
5. **Optional form-switch costs:** default free; AP, Mana/Holy Power or custom resource, or both; full validation on portrait and form selectors; Base remains free.
6. **Stat discounts for custom ability AP:** None/STR/DEX/INT/FTH, pure `WBCombat` formula with half-cost floor; update cards, availability and filters.
7. **Cloud operation and live-session planning only:** confirm player account onboarding/privacy and invitations (disable open signups if appropriate; configure reliable email delivery). Write the in-person DM-computer/phone, player-phone join-code design with secure memberships, redacted views and revision-safe actions. **Await DM approval before implementing actual multiplayer.**

## Later improvements

- More maps, ally tokens, doors and the Barrow puzzle; user-uploaded map images and terrain/light/darkness brushes.
- Richer status presets, consumables, currency, gear sets, custom resource/ability templates and dice animations.
- DM encounter history/export and optional battlemap UI polish.
- Cloud portrait object storage and automatic sync only after safe ownership/conflict design.

## Undecided — do not build

AP growth by level; Block dice scaling by level and shield sizes; two-handed versus dual-wield damage; AP costs for smaller actions; WIS actions; Exhaustion redesign. Proposals in CONTEXT.md are not decisions.
