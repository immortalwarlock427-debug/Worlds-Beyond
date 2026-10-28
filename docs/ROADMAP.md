# Roadmap

## Battlemap
- Doors that open and close, and making the sealed ring door in the Barrow a puzzle.
- Uploading your own map picture, and a brush to paint walls, terrain, light and magical darkness onto it.
- More generated maps (the scripts in `maptools/` draw them in the same style).
- Tokens for allies.

## Sheet
- Custom resources: basic manager delivered in Draft 30; later connect resource costs to the universal ability builder, add reusable templates and per-form pools.
- Ability Library (capacity and quick use in next PR): separate maximum active/held creations from limited ability charges; keep an accessible Use button on collapsed and expanded cards. Future: named creations, bulk effects, and per-instance expiry.
- Ability Library v1: create, edit, duplicate, delete, favorite, categorize and search abilities; record optional AP/resource costs, cooldowns, durations, uses (blank = unlimited), descriptions and notes without automating activations. Activation prototype: Use button validates/deducts AP or chosen resources, starts cooldown/duration trackers, and spends limited charges; turn start counts down and long rest resets. Temporary Movement effects (ft/AP) implemented in draft: activated bonuses add to effective movement for their duration without modifying base stats; expire at turn start. Next PR: multiple effect rows per ability; Armor Rating, Evasion, the 8 stats, and custom resource max added. Future: resource current-value deltas, richer duration rules, triggers, combat reset, and status overview.
- Spells: a list with level and tier, mana cost from the Magic System table, AP cost 11 − INT or FTH mod
  (minimum 6), damage, area and save (DC 12 + mod), concentration, and a Cast button.
- Milestone buttons and trackers: Devastate and Singularity as toggles on attacks; pips for Indomitable, Miracle and
  the once-per-round ones; a New combat button.
- Block scaling and two-handed damage, once decided.
- A future Status Effects screen listing every current condition, buff, debuff and timed effect together, with remaining durations and sources; keep this separate from the ability editor.
- A conditions tracker, after the Exhaustion revamp.
- Character export/import/clear moved to the top, accessible from Sheet and Battlemap. Notes, consumables and currency. Visual polish. Later: set bonuses across slots.
- Ability Library enhancements after v1: richer filters (type, resource, cost, cooldown, favorites), organization for large collections.

## Website

The sheet grows into a lightweight, Foundry-style tool (not built inside Claude). Done so far: the sheet and
battlemap are a static site on GitHub Pages, with the character and the game saved separately.

- **Games:** the DM creates a game; a "server" is just a game record with a join code. Players join with the code
  and bring their character.
- **Visibility:** the DM sees full sheets; other players see only the basic info each player chooses to share.
- **Combat screen:** the DM moves everyone into combat, with initiative order and creatures to target, and a
  battlemap of 5 ft squares where each player moves their own token, spending their AP by the Movement rules.
- **Stack:** this site as the front end, a hosted database with accounts and live sync (Supabase or Firebase, both
  with free tiers), and static hosting (GitHub Pages). No server machine to run.
- **Character format:** the sheet's exported `.json` file, so characters move between the sheet and the site.

### In this order

1. **A DM screen** that loads exported character files, with no networking. This is when `js/app.js` gets split
   into modules (rules, character, game, map, sheet view, map view), so both screens share the same rules code.
2. **A combat tracker** on it: initiative, Health, targets, then the battlemap with every character's token.
3. **Accounts, games with join codes, and live sync:** a hosted database with accounts (Supabase or Firebase, both
   have free tiers). The DM creates a game; players join with the code and bring their character.
4. **Per-player sharing:** the DM sees full sheets; other players see only what each player chooses to share.
