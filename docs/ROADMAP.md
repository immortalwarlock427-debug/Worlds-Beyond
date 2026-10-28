# Roadmap

## Battlemap
- Doors that open and close, and making the sealed ring door in the Barrow a puzzle.
- Uploading your own map picture, and a brush to paint walls, terrain, light and magical darkness onto it.
- More generated maps (the scripts in `maptools/` draw them in the same style).
- Tokens for allies.

## Sheet
- Spells: a list with level and tier, mana cost from the Magic System table, AP cost 11 − INT or FTH mod
  (minimum 6), damage, area and save (DC 12 + mod), concentration, and a Cast button.
- Milestone buttons and trackers: Devastate and Singularity as toggles on attacks; pips for Indomitable, Miracle and
  the once-per-round ones; a New combat button.
- Block scaling and two-handed damage, once decided.
- A conditions tracker, after the Exhaustion revamp.
- Notes, consumables and currency. Visual polish. Later: set bonuses across slots.

## Website (in this order)
1. **A DM screen** that loads exported character files, with no networking. This is when `js/app.js` gets split
   into modules (rules, character, game, map, sheet view, map view), so both screens share the same rules code.
2. **A combat tracker** on it: initiative, Health, targets, then the battlemap with every character's token.
3. **Accounts, games with join codes, and live sync:** a hosted database with accounts (Supabase or Firebase, both
   have free tiers). The DM creates a game; players join with the code and bring their character.
4. **Per-player sharing:** the DM sees full sheets; other players see only what each player chooses to share.
