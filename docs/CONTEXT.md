# Worlds Beyond: Context

The up-to-date project reference for Worlds Beyond, a customizable homebrew D&D character sheet and combat system. **Implemented** features, **decided but unbuilt** mechanics and **undecided** ideas must be kept separate. Update these sections in place; git history already records individual PRs.

## Where things live

- **Rules:** Notion → [D&D > Game Systems](https://app.notion.com/p/351c72092efb8089812cd231debc3e74), including Stats, Action Points, Defenses, Magic, Status Effects, Equipment and [Death and Dying](https://app.notion.com/p/707a548ff2354d0ba02e7979ca9bda1c). Weavecasting is a separate system; don't mix it in.
- **Live site:** [Worlds Beyond on GitHub Pages](https://immortalwarlock427-debug.github.io/Worlds-Beyond/). Plain HTML/CSS/JS without a build step. README covers navigation; ARCHITECTURE describes modules/saves; ROADMAP tracks future work; AGENTS gives collaboration rules.
- **Local saves:** separate character (`worlds-beyond-sheet-v1`) and DM game (`worlds-beyond-game-v1`) records. v1 character JSON exports exclude map, fog and encounter data. The game holds map, fog, legacy tokens/foes and optional offline encounter.
- **Cloud character copies:** Supabase Auth and `wb_characters` owner-only RLS. The site auto-connects using the **public publishable** configuration; manual Save and Restore are separate from local character data. No cloud game/encounter sync.
- **Claude artifact:** build from merged `main` with `python3 tools/build_single.py`.

## How we play and work

- **In person:** each player has **their own phone** and character sheet. The DM uses a **computer and a phone**. All live-session designs must support separate devices, not assume shared browser storage.
- **Trust-based sheet:** players can customize and correct stats, resources and abilities. **Do not add anti-cheat or restrictive gameplay validation unless explicitly asked.** Account privacy, server access control and preventing accidental shared-data overwrites are separate security requirements.
- The DM levels characters at story milestones and discourages metagaming. Keep the interface editable/resettable for mistakes.
- Critically evaluate ideas; identify contradictions or unnecessary limits. Write 1.5× or 150% for multipliers.
- When a rule changes, reconcile Notion, the site and this context. **Do not append a new section for each PR.**

## What the site does (Draft 37)

The following features **already exist** in the live site:

- **Character interface:** Overview, Attributes, Equipment, Abilities and Status Effects sub-tabs, plus separate Battlemap; portraits, vitals, Death Threshold/Trauma, Mana/Holy Power, AP, reactions, Wonder, concentration, manual overrides, rests, advancement, export/import and clearing the sheet.
- **Shared combat core:** `WBCombat` handles effective stats, gear, Armor Rating, AP, Surge, attacks, dual hits/criticals, resistance, defenses and death calculations. Character progression and shared combat formulas are reusable; dice UI is separate.
- **Equipment:** Pack, Forge, worn slots, weapon actions and bonuses. Named forms use one shared inventory but may wear different equipment profiles.
- **Custom Ability Library:** create/edit/duplicate/delete/favorite, categories, search/sort/filters, compact display, optional AP/Mana/Holy Power/custom-resource costs, Use action, limited uses, held creations, cooldown, duration, ongoing numerical effects and turn/long-rest processing. Active effects support movement, Armor Rating, Evasion, stat scores and custom-resource maximums.
- **Forms and portraits:** named ability loadouts can be bidirectionally linked to portraits. Forms change available abilities, can adjust effective stats, gate custom resources/Mana visibility and swap worn equipment. Cooldowns, charges, effects and resource balances carry over. **Currently switching forms is free.** Effective scores may exceed 28 and unlock milestones.
- **Custom resources:** independent named pools with current/max, colors/display, manual spend/restore, turn regeneration, long-rest refill, ability costs and form availability.
- **Status Effects:** shows active timed ability effects and their bonuses, plus manually added Buff, Debuff, Condition and Other entries with optional expiration timers. Manual statuses are descriptive until an actual rule applies.
- **Character Battlemap:** blank, Stone Hall and Barrow grids; fog/line of sight, light, terrain, enemies, targeting, AP movement, Surge, free positioning and undo. Its fog-aware planning uses shared `js/routing.js`.
- **Offline DM Room:** import player snapshots and NPCs, initiative/rounds/turns, AP, Health, damage/healing, manual token placement and confirmed AP-based path movement with animation. Finishing combat allows **Reuse roster / Edit setup**. DM encounter positions are distinct from sheet Battlemap positions and do not sync to other devices.
- **Same-browser Player Preview:** `player.html` can display selected player stats/public encounter positions and submit MoveToken/SpendAP/EndTurn in another tab of the **same browser origin**. Seat selection is not authenticated and it **is not** the planned phone-player multiplayer solution.
- **Cloud Saves:** `cloud.html` automatically connects to the configured Supabase project; users can sign up/sign in, manually save/list/restore/delete private character copies with revision conflicts and backups. Cross-device character restore has been tested; **automatic saving and live encounters are not implemented**.

### Known implementation gaps

- The sheet Battlemap and DM Room both use pure `WBRouting` for routes; the sheet supplies fog-limited terrain and visible foes, while DM uses full map terrain and its actor roster.
- DM character imports exclude active temporary ability bonuses from combat stats, retaining current equipment, form bonuses and manual overrides. A visible warning lists each active ability, its bonuses and remaining turns; encounter timers for imported effects are still not implemented.
- Custom abilities do **not yet** apply stat-based AP discounts. Named form entry can now charge AP and/or Mana/Holy Power or a custom resource; returning to Base remains free.
- Existing automated tests include many source-text assertions; real browser-click/390px tests need broader coverage.
- No authenticated cross-device DM game, join codes, server-authorized encounter commands, or live multiplayer synchronization.

## Confirmed decisions for upcoming work — not implemented yet

- **Form-entry cost — implemented:** named forms can charge AP, Mana/Holy Power or a custom pool, or AP plus a resource. Blank defaults to **free** for legacy forms. Entering through a selector or linked portrait checks all costs before spending; returning to **Base is free**, and selecting the already active form costs nothing. Switching worn gear profiles happens with the form.
- **Ability AP discounts:** add `Discounted by: None / STR / DEX / INT / FTH` per ability, default **None**. Effective AP cost is `max(ceil(base AP / 2), base AP − current modifier)`; negative modifiers raise cost. Compute this in pure `WBCombat` and use it for activation, on-card base/effective prices, `Usable now` and AP-cost filters.
- **Unified movement:** one shared DOM-free route algorithm used by sheet and DM. Preserve the sheet's fog planning (unseen squares assumed open; only visible standing enemies obstruct planning; travel stops when encountering a newly revealed obstacle). **Allies and downed creatures of either side are traversable at normal cost but cannot be destinations; standing enemies block.** Give DM actors editable `Party`/`Enemy` sides; imported PCs default Party, NPCs Enemy. Retain eight-direction movement unless a separate rule decision changes costs.
- **Temporary effects on DM import — implemented:** only non-temporary combat stats are imported; active ability effects are shown as individual warnings with bonuses and turns remaining, rather than baked into permanent Armor Rating, Movement, Initiative, or stat-derived values.
- **Browser tests:** Playwright scenarios for resource spend/restore, ability AP/cooldown/turn progression, separate forms/gear/resources, timed statuses, export/import, DM import/combat/movement/AP and no sideways scrolling at 390px. CI should run every `tests/` file.
- **Live multiplayer:** prepare a **plan only**, awaiting DM approval. DM hosts from computer/phone; each player joins from their own phone with an account, join code and cloud character, sees the permitted map and moves their token on their turn. Use backend membership, secure per-player reads and safe shared revisions; **do not** add anti-cheat restrictions to customizable sheets.

## Core rules

- **Stats:** STR, VIT, DEX, AGL, INT, WIS, CHA, FTH. Roll 2d6 + 1d12 eight times and assign. That averages 13.5,
  which is fine for player characters; 12 is the base 0 and the average adventurer. 28 is the natural/mortal limit; effective scores **may exceed 28** through gear, forms and ability effects. Scores above 28 still unlock 21/28 milestones.
- **Modifiers:** +1 per 3 points from 12 (13–15 is +1, 16–18 is +2, 9–11 is −1). STR and DEX use (score − 12) ÷ 2,
  rounded down. Them falling behind at 13 is intended.
- **Milestones** at 21 and 28 go by your current score, gear included: gear can unlock one and dropping below loses
  it. That means AGL gear can grant extra reactions and Surge, which is fine.
- **Outside combat:** once-per-combat abilities become once per long rest; once-per-round abilities get uses equal to
  the stat's mod per long rest.
- **Ability score increases:** levels 4, 8, 12, 16 and 19, 4 points each, max 2 in any one stat per level-up.
- **Health:** level 1 = max hit die + half VIT (rounded down); each level after = roll the hit die + half VIT. The hit
  die comes from VIT (table on the Stats page). Not retroactive: high starting stats grow faster.
- **Mana / Holy Power:** from INT, or FTH for faith users. Level 1 = (stat − 12) × 3, then a per-level amount from the
  Magic System table. Spells cost mana by spell level and tier (Lesser, Intermediate, Advanced).
- **Natural Evasion** = 10 + AGL mod; an attack has to meet or beat it.
- **Armor Rating** = VIT mod + worn armor, minimum 0. Adamantine Body (VIT 28) makes it half VIT (rounded down) + armor.
- **Initiative** = d20 + WIS mod. **Movement** = 5 ft + 5 ft per AGL mod, per AP (minimum 5 ft). On a map every
  square is 5 ft, diagonals included, and difficult terrain costs 10 ft a square. Diagonal moves are fine, but you
  can't slip diagonally between two walls that touch at a corner. Taking stairs to another level costs nothing
  beyond the move onto the stairs (sheet assumption). If something you couldn't see blocks your path, you stop next
  to it and only pay for the distance you moved.
- **Sight:** you see what's in line of sight if it's lit, or within your sight in the dark: the farther of your
  darkvision and the light you carry (not the two added). The squares next to you are always seen. Maps are lit or
  dark, dark maps have light sources, and magical darkness can't be seen into or through by anyone. Darkvision
  differs by character (race, gear).
- **Reactions:** 1, +1 at AGL 21, +1 at AGL 28. They come back at the start of your turn.
- **Wonder:** reroll any non-attack d20, uses = FTH mod per long rest. Defy Fate (FTH 21) turns each use into an
  automatic success on a failed save or check, Dodge and Parry included; on initiative it still just rerolls.
- **Save DC** for an ability = 12 + that stat's mod unless it says otherwise (Commanding Presence uses 10 + 2× CHA mod).
- **Concentration** (VIT): check whenever you take more damage than your VIT mod. DC 12 or half the damage taken,
  whichever is higher.
- **Crits:** a natural 20 always hits, can't be dodged (Block and Parry still work), and deals max dice + the dice
  rolled again.
- **Level cap:** depends on who's DMing.

| Stat | 21 | 28 |
| --- | --- | --- |
| STR | Devastate | Overwhelming Force |
| VIT | Indomitable | Adamantine Body |
| DEX | Parry | Singularity |
| AGL | Surge | Flicker |
| INT | Stratagem | Absolute Comprehension |
| WIS | Sixth Sense | Eyes of Truth |
| CHA | Commanding Presence | Unassailable Self |
| FTH | Defy Fate | Miracle |

## Action Points and attacks

- **AP:** start at 15. How AP grows with level is still undecided. Gear never raises AP or reactions directly.
- **Costs:** a standard action is 10 AP and a spell is 11 AP. A stat's mod lowers the cost of actions in its area:
  STR weapon attacks, shoves and grapples; DEX finesse attacks and hand actions; INT arcane spells and tactical
  actions; FTH holy spells and prayers. The floor is half the normal cost, rounded up (weapon attack minimum 5,
  spell minimum 6). **Custom abilities currently have flat AP costs, pending the decided stat discount field.** VIT and AGL give no discounts; AGL sets movement.
- **Weapon attack** = 10 − STR or DEX mod, minimum 5. One- and two-handed attacks cost the same.
- **Dual wielding:** with a one-handed weapon in each hand you choose a main-hand attack, an off-hand attack or a
  both-hands attack, all at the same AP. A one-hand attack does full damage, so an off-hand axe can be thrown on its
  own. With both, each hand rolls to hit and the off-hand hit does half damage, rounded down.
- **Opportunity attacks** use a reaction, not AP. They are the only attacks made with a reaction.
- **Surge** (AGL 21): 2 AP of free movement each turn, plus an extra reaction.
- **Command:** spend 5 AP to give an ally 2 + CHA mod AP (max 5). AP is only moved around, never created. Like
  temporary Health it doesn't stack: you keep the highest Command you've received, and you use it on your own turn.
- **Stabilize someone:** 5 AP, d20 + INT mod against DC 12.
- **Milestone actions** Stratagem, Absolute Comprehension, Commanding Presence and Eyes of Truth cost 5 AP.

## Defenses

Each defense uses a reaction. Order of a hit: the attack meets or beats Natural Evasion (or is a natural 20) → Dodge
or Parry → resistance halves → Armor Rating comes off → Block → Overwhelming Force keeps it from dropping below half.

- **Block:** needs arm guards, a weapon or a shield (not bare skin or clothes). Roll 1d4 + STR mod and take it off
  the damage after Armor Rating. A shield replaces the 1d4 with its own Block die, from 1d6 (poor) up to 1d10 or
  1d12 (fine). Covering all of it is a full block, which also stops on-hit effects that need to cut into you, like
  poison. Works on physical things like swords and fireballs, not mind control. With a shield you can also block for
  anyone you could reach with 1 AP of movement, after their Armor Rating.
- **Dodge:** d20 + AGL mod; you must beat the attack roll (a tie hits, full damage). Against an area attack Dodge is
  the save: meet the DC and take half. Mind control can't be dodged, and neither can a natural 20. After a failed
  Dodge you can still Block with another reaction.
- **Parry** (DEX 21): needs a weapon or shield in hand, once per round. d20 + DEX mod; beating the attack roll
  negates its damage and any non-magical effects. Works for anyone you could reach with 1 AP of movement; you move
  in front of the attack. Works against a natural 20 too.
- **Resistance** halves the damage first, then Armor Rating comes off.
- **Overwhelming Force** (STR 28): nothing can bring the damage below half, Armor Rating, Block and Parry included.
  A successful Dodge still avoids it completely.

## Death and dying

There are no death saves. At 0 Health or below you're unconscious and bleeding out, and Health keeps going negative.

- **Death Threshold** = level + VIT. You die when Health reaches the negative of it.
- **Death's Mercy:** the first time you go below 0, the damage that takes you negative can't be more than half your
  Death Threshold. After that, damage hits in full. It's the first time you go negative at all, not the first big hit.
- **Bleeding out:** lose 4 Health every turn at 0 or below. Armor Rating and resistance don't reduce it (an artifact
  ability might).
- **Stabilizing:** someone spends 5 AP and rolls d20 + INT mod against DC 12. On a success you stop bleeding but stay
  unconscious. If no one can heal you, 10 minutes of treatment after combat brings you to 1 Health.
- **Indomitable** (VIT 21): when you're dropped below 0, roll d20 + VIT mod against DC 12. On a success you stop
  bleeding but stay unconscious.
- **Trauma:** each time you're reduced to 0 and recover, your Death Threshold drops by 5 until a long rest. If it
  reaches 0, the next time you go below 0 you die.
- **Exhaustion** is being revamped; ignore the current Notion page for now.

## Gear and weapons

- **Slots:** head, amulet, torso, both arms, both rings, belt, both legs, plus main hand and off hand. A piece marked
  as a set, like boots, fills both arms, both legs or both ring slots, and its armor, bonuses and effects count once.
- **Weapons:** one-handed (you can hold two) or two-handed (takes both hands). Each uses STR or DEX (finesse), and has
  a Range on the battlemap (5 ft unless set). Shields go in the off hand only. The Weapons page in Notion is about
  4 years old and will be revised.
- **Three main fighting styles:** two-handed (hits hardest, beats armor), one hand and shield (tanky, guards allies),
  dual wielding (many consistent hits). Other side styles can exist.
- **Gear bonuses** can raise stats, Max Health, Max Mana/Holy Power, Evasion, Initiative, Movement, Darkvision and
  Light.
- **Level-ups:** gear only counts toward a level-up's Health, Mana and hit die if you wore it through a long rest. It
  never changes past levels.
- **Item effects on the sheet:** extra damage dice + damage type, attack bonus, damage bonus, defense bonus (all or
  Block/Dodge/Parry), resistance, on-hit reminder, a shield's Block die, and abilities with limited uses (per long
  rest or per round). A weapon's effects only work for that weapon; effects on other gear work for all your attacks.
  Anything more complex is handled at the table.

## Assumptions on the sheet (confirm or change)

- On an area Dodge, meeting the save DC counts as a success.
- Adamantine Body's "half VIT" includes VIT from gear.
- Anything in an arm slot counts as arm guards for Block.
- Base Block die is 1d4 (not 1d6), so even a poor 1d6 shield is an upgrade.
- Bleeding happens at the start of your turn.
- Healing while negative counts up from the negative number (heal 10 at −8 → 2).
- Death's Mercy applies again each new time you drop below 0 (it resets once you're back above 0).
- You die at exactly the negative of your Death Threshold.
- Indomitable's roll uses the VIT modifier, not the score.
- Concentration DC halves the damage rounded down.
- Stabilize costs a flat 5 AP; INT doesn't discount it.
- The off-hand's half damage includes its extra damage dice; a both-hands attack's AP cost uses the main hand's stat.
- Movement spends whole AP; feet left from an AP you started stay usable for the rest of that turn. Surge's 2 free AP
  are used before your own.
- CHA gives no discount on Command (flat 5 AP). At CHA 8 or lower it gives 0 AP, so the sheet won't spend it.
- AP from a Command goes on top of your own (it can pass your max), is spent before your own AP, and is for your
  next turn. It's gone at the start of the turn after.
- A set counts its armor once for the whole pair.
- Reach shading only shows on squares you've seen, so it doesn't give the layout away. Free placement ignores the fog.
- **Decided occupancy rule:** standing enemies block; allies and downed creatures of either side can be crossed but never used as the destination. The DM and character-sheet pathfinders now share `WBRouting`.
- A weapon reaches 5 ft unless its Range says otherwise, and needs line of sight; the square next to you always
  counts as in sight. A both-hands attack needs the target in reach of both weapons.
- Against an enemy on the map, Armor Rating comes off each hit separately (the off-hand after halving).
- Gear can add to Darkvision; light from gear and light carried don't stack (the larger counts).
- Attacks need a clear line to the target, not light.
- The Barrow's light sources match its picture: braziers 20 ft, daylight on the stairs 15 ft, glowing fungus 10 ft,
  candles in the niches and the sealed door's glow 5 ft.

## Direction: customizable characters

Eight stats, AP and the homebrew combat system are the core, while character resources, abilities, statuses, forms and transformations stay customizable. Those editors and automatic ability effects **are already implemented**; the unbuilt refinements are above.

## Open design questions

### Block scaling (proposal, not decided)

Mix of both: **level sets how many Block dice you roll, gear sets the die size.** Arm guards or a weapon roll d4s;
a shield swaps in its own die. Then STR mod is added as now. Shields stay worth having because their lead grows with
level, and characters without a shield still scale a little. The cadence below (an extra die at 5, 10, 15, 20) is an
example to tune.

| Level | Block dice | Base (d4) | Poor shield (d6) | Good shield (d10) | Best shield (d12) |
| --- | --- | --- | --- | --- | --- |
| 1–4 | 1 | 2.5 | 3.5 | 5.5 | 6.5 |
| 5–9 | 2 | 5 | 7 | 11 | 13 |
| 10–14 | 3 | 7.5 | 10.5 | 16.5 | 19.5 |
| 15–19 | 4 | 10 | 14 | 22 | 26 |
| 20 | 5 | 12.5 | 17.5 | 27.5 | 32.5 |

Averages before STR mod. Level-only scaling makes shields fall behind; gear-only means characters without shields
never scale and it all depends on loot. Magic shields can still add a flat +Block (the Forge already supports it).
Calibrate against typical monster damage per hit once that's set, for example Block ≈ a quarter of a same-level hit
without a shield and about half with a good one. A bigger Block also means more full blocks, which stop poison and
other on-hit effects, so tanks will shrug those off more often.

### Two-handed vs dual wield damage (proposal, not decided)

All attacks cost the same AP, so compare damage per attack. Dual wield ≈ 1.5× a one-hander, so the target is
**two-handed = dual wield against an unarmored target**; armor then decides between them, because flat Armor Rating
eats many small hits. Two parts:

1. Two-handed dice average about 1.5× the one-handed die of the same tier.
2. Two-handed attacks add 1.5× your STR or DEX mod (rounded down). Without it, dual wield pulls ahead as mods grow,
   because it adds the mod 1.5× (full plus half).

| One-handed | Average | Two-handed target | Dice that fit |
| --- | --- | --- | --- |
| 1d6 | 3.5 | 5.25 | 1d10 (5.5) |
| 1d8 | 4.5 | 6.75 | 2d6 (7) or 1d12 (6.5) |
| 1d10 | 5.5 | 8.25 | 2d8 (9) or 1d8 + 1d6 (8) |
| 1d12 | 6.5 | 9.75 | 1d10 + 1d8 (10) |

Expected damage per attack, every swing hitting, 1d8 one-handers vs a 2d6 two-hander:

| Mod | Enemy Armor Rating | Dual wield | Two-handed (1× mod) | Two-handed (1.5× mod) | One hand + shield |
| --- | --- | --- | --- | --- | --- |
| +3 | 0 | 11.0 | 10.0 | 11.0 | 7.5 |
| +3 | 6 | 1.9 | 4.0 | 5.0 | 1.9 |
| +6 | 0 | 15.5 | 13.0 | 16.0 | 10.5 |
| +6 | 6 | 4.6 | 7.0 | 10.0 | 4.5 |

With 1.5× mod, two-handed matches dual wield against no armor at every level and pulls well ahead against armor. With
1× mod, dual wield is better against lightly armored crowds and two-handed against armored targets, which is also a
valid split. Either way, Armor Rating 6+ shuts down one-handed hits, so monster Armor Rating and player damage need
tuning together.

### Still open

- How AP grows with level.
- What WIS actions exist.
- AP costs of smaller actions.
- More weapon categories, and revising the old Weapons page.
- Exhaustion revamp.
- If you ever want stat rolls to average 12: 1d10 + 1d12 (flat, more extremes) or 4d6 − 2 (bell-shaped). Currently
  keeping 2d6 + 1d12.


## Roadmap and website plan

See [ROADMAP.md](ROADMAP.md) for pending items and [ARCHITECTURE.md](ARCHITECTURE.md) for engineering detail.

## Character command foundation (merged PR #35)

`WBCharacter.derive/apply` now provides pure, DOM-free **custom resource** derivation and typed adjustments. The resource UI routes Spend/Restore/Fill, current/max edits, regeneration and long rest through it. Loading, importing and rendering no longer truncate a valid above-base resource when a temporary max modifier is running; an actual max decrease is reconciled through a gameplay transition. **AP, built-in Mana, Health, forms and ability activations are not yet fully migrated. Automatic triggers, configurable hard overflow caps and the general rule editor do not exist yet.** The details and unresolved choices are in [AUTOMATION_PLAN.md](AUTOMATION_PLAN.md); the immediate Codex task is in [CODEX_START_HERE.md](CODEX_START_HERE.md).
