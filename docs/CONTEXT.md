# Worlds Beyond: Context

Everything a new chat or AI assistant needs to work on Worlds Beyond, in one place. Worlds Beyond is my homebrew
D&D combat framework built on 8 stats and Action Points. **This file is the main copy of the project context**:
when a rule or the site changes, update Notion, the site and this file to match.

## Where things live

- **Rules:** Notion, [D&D > Game Systems](https://app.notion.com/p/351c72092efb8089812cd231debc3e74). Pages: Stats
  (each stat has its own page with milestone text), Ability Scores, Action Points, Defenses, Magic System, Status
  Effects Explained, Exhaustion Effects Explained, Armor Types, Weapons Explained, Metals Explained, and
  [Death and Dying](https://app.notion.com/p/707a548ff2354d0ba02e7979ca9bda1c). This file summarizes them below.
- **The site:** this repository, served by GitHub Pages at https://immortalwarlock427-debug.github.io/Worlds-Beyond/.
  Plain HTML, CSS and JavaScript with no build step. `README.md` is the overview, `docs/ARCHITECTURE.md` explains the
  code and the saves, `docs/ROADMAP.md` is what's next, and `AGENTS.md` (also read through `CLAUDE.md`) has the
  working instructions.
- **Two saves:** the character (localStorage `worlds-beyond-sheet-v1`) and the game (`worlds-beyond-game-v1`: map,
  every character's token by character id, enemies, explored fog) are saved separately. Export/Import moves a
  character between browsers as a `.json` file and never carries the battlemap.
- **The Claude artifact:** a one-file copy of the site published on claude.ai, pinned in my sidebar. Build it from
  this repo with `python3 tools/build_single.py` and publish to the same artifact; don't start a new one.
- **Commits** use the GitHub no-reply email (`immortalwarlock427-debug@users.noreply.github.com`), because GitHub
  blocks pushes that would publish a private email.
- **Weavecasting** is a separate magic system. Don't mix its rules in.

## How I want you to work

- Critically evaluate my ideas: flag contradictions, redundancies, exploits, unnecessary rules and knock-on effects.
- Don't invent extra restrictions unless they're actually necessary.
- Write multipliers as 1.5× or 150%, never "half again".
- I level characters up at story milestones and don't allow metagaming.
- The sheet should follow the rules, but everything should still be resettable or changeable in case someone messes up.
- When rules change, update Notion, the site and this file to match.

## Ability effect expansion (proposed next PR)
- One ability may apply multiple additive temporary effects to Movement (ft/AP), Armor Rating, Evasion, any of the eight stat scores, and custom resource maximums.
- Effects contribute to effective values while active; permanent base scores, gear, and resource maximums remain unchanged. Resource capacity bonuses do not refill current points. Editing active effects cancels their duration. Existing single Movement effects migrate to the multiple-effect format.

## Navigation update (next PR)
- Separate top-level destinations for Character Sheet and Battlemap. Character has five sticky sub-tabs: Overview (identity, vitals, defenses), Attributes (stats and advancement), Equipment (including forging), Abilities, and Status Effects. Sections are hidden rather than destroyed so existing controls, state, calculations and save format remain unchanged.
- Deep links: #map stays Battlemap, #sheet and no hash default to Overview, #status still opens Status Effects, and #sheet/{overview|attributes|equipment|abilities|statuses} selects a character sub-tab. Switching out to Battlemap and back preserves the current character sub-tab within the session.
- Export, Import and Clear remain in the shared top controls. Battlemap/game data remain separate from character saves.

## Status Effects view (next PR)
- A third Sheet / Status Effects / Battlemap navigation tab uses #status and is part of the same website; it does not create a separate game state. The status view shows active ability effects, their numerical bonus details and remaining duration, and can end an ability's active effect early (without refunding AP/resources or removing its cooldown).
- Players can also add manual status entries (Buff, Debuff, Condition or Other), with a source, notes, and optional turn timer. These are descriptive only and do not silently alter combat math. Timed entries expire when the player starts a turn; blank duration persists until removed. Manual statuses are retained across long rests until explicitly removed or expired. All entries save with the character and migrate from older character files as an empty list.
- Future integration: automatic conditions from the defense/health system, treatment and recovery rules, richer effect sources and filters.

## Ability Library filtering and compact mode (next PR)
- Ability sub-tab offers search, custom category, type (Active/Passive/Reaction/Other), resource paid with (including Mana/Holy Power and custom pools), AP-cost band, availability (Usable now / Cooling down / Out of uses / Effect active / Passive), favorites, and sorting. Compact view reduces scrolling while preserving the quick Use button and ability editor.
- The Usable now filter invokes the same validation as activation, including current AP, resources, cooldowns, remaining uses, and capacity; it does not spend anything. Filters do not mutate or delete stored abilities and reset to all when creating or duplicating one. UI presentation preferences are not part of exported character data.
- CSS and JS assets share a cache-busting release token in index.html, following docs/ARCHITECTURE.md, to prevent the live GitHub Pages site mixing old cached files.
  
## Ability Forms / Loadouts v1 (proposed PR)
- Named ability forms are independent from portrait-image forms. Selecting Warrior, Mage, or another specific form while Shared is checked immediately turns Shared off; clearing the last selected form restores Shared. The shared checkbox can also clear specific selections with one click. A player can create forms (e.g. seven character classes), assign an ability to any combination of forms, or leave it shared for all. Default old abilities are shared. Base mode shows shared abilities only once forms exist; with no forms the current ability library is unchanged.
- Switching the active ability form only changes which abilities can be activated; it does not change AP, resources, equipment, stats, portrait, or active effects. **Cooldowns, charges, held-creation counts, and timed effect durations carry between forms** and continue to decrement normally, avoiding reset exploits.
- A Show all option exposes other-form abilities for editing but does not permit their activation. Deleting a form removes its references; if it was the only assigned form, the ability becomes shared. Ability loadouts and active selection are saved/exported with character JSON, never the game save.
- Future: real transformations with separate resource sets and optional gear/stat profiles must explicitly define how active effects behave.
  
## Mechanical Forms phase two (next PR)
- Each named Ability Form can optionally link to one existing portrait from Overview. **Switching forms selects its linked portrait, and clicking a portrait thumbnail on Overview also activates its linked ability form**, updating available skills and derived stats. An unlinked portrait selects Base/shared abilities. When multiple forms link to one portrait, keep the current form if it matches; otherwise select the first matching form. Unlinked forms and selecting Base in the ability manager leave the current portrait alone. Deleting a portrait clears links without deleting its form and selects the next portrait's linked form (or Base).
- Each form can configure temporary signed score adjustments for the eight stats (bounded -28..+28). These add to effective scores, alongside equipment and active ability effects, and therefore feed normal derived modifiers and defenses. They never rewrite purchased points, level history, equipment or an explicit manual modifier override.
- Switching to a different form replaces the previous form's modifiers instead of stacking. Switching to Base removes all form-specific modifiers. Ability cooldowns, duration effects, capacity and resource balances still carry across form changes.
- Mechanical settings are in a collapsible editor in the Abilities tab so routine switching stays compact. No AP cost or cooldown for switching in phase two, and this is not yet a full resource/gear transformation system.
  
## Form-specific resources (next PR)
- Each custom resource now stores optional `loadoutIds`; empty means shared across forms. The resource manager on Overview assigns resources to one or more ability forms. A player can show pools from other forms for editing, but those are unavailable for Spend/Restore/Fill or ability activation until their form is active. Hidden pools keep their current balance, capacity, regeneration setting and name. Switching forms never refills or resets them.
- Resources regenerate at start of turn **only while their form is available**, avoiding hidden-pool free regeneration during another form. Long rest refills all opted-in custom resources, including inactive pools. Deleting a form removes its resource assignment; a pool with no remaining assignments becomes shared. Legacy resources are shared by default.
- Existing built-in Mana/Holy Power is one shared balance, not copied per form. Each form can choose to follow the global Mana visibility toggle, force Mana visible, or hide/disable it. Costs are validated against the effective visibility before spending AP, including the Ability Library's Usable Now filter. Future: separate Mana balances or entirely independent per-form resources, if needed.
- All state is saved in the character JSON; game/map storage remains separate.
  
## Form-specific worn equipment (next PR)
- The Equipment tab shows the active form's worn-slot profile (Base or a named ability form). All forms share one inventory and item identities, but each form can save distinct worn slots and hence different armor, weapons, gear bonuses and attack options. Switching forms or linked portraits swaps worn slots without touching AP, cooldowns, resource balances, item charges, long-rest settled history or ability effects.
- New forms start wearing the current gear, then can diverge. The Equipment tab offers Copy Base and Unequip All for this form; both retain the shared inventory. Deleting an item removes it from every profile. Deleting the active form restores Base gear. Legacy characters migrate existing equipment safely; character export/import preserves all profiles.
- This stage does not copy gear into separate inventories, enforce transformation AP costs, or reset gear progression on every switch.
- The cloud/DM/multiplayer migration plan lives in `docs/CLOUD_MULTIPLAYER_PLAN.md`: reusable rules modules, versioned state migrations, account-owned characters, DM-owned sessions, backend permissions, local-first sync and later online sessions.

## Multiplayer-ready foundation refactor (current PR)
- First safe step: `js/persistence.js` owns existing character export/import (format/version 1), browser storage with original character/game keys, and a testable in-memory adapter. `js/app.js` uses it for load, save, clear, portrait upload, import/export; there are no direct localStorage get/set/remove calls left in app. Bad JSON and unsupported future-format imports are rejected. No cloud accounts or network requests yet.
- `js/game-state.js` extracts the existing pure blank/normalize game state logic for maps, fog, tokens and foes so the future local DM screen can reuse it. The main UI retains its current rules and renderers. Next: extract pure stat/gear/AP movement actions and add versioned migrations, then implement local DM screen before live sessions.
- Strict ownership: individual characters belong to players, game session map/fog/enemies belong to DM/session; preserve existing separate save formats. Cloud sync later needs authenticated owners, revision/conflict checks, offline queues, and server-side permissions. Full plan: `docs/CLOUD_MULTIPLAYER_PLAN.md`.
  
## Core rules

- **Stats:** STR, VIT, DEX, AGL, INT, WIS, CHA, FTH. Roll 2d6 + 1d12 eight times and assign. That averages 13.5,
  which is fine for player characters; 12 is the base 0 and the average adventurer. 28 is the mortal limit.
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
  spell minimum 6). VIT and AGL give no discounts; AGL sets movement.
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

## What the site does (Draft 30)

- **Identity:** fields, and portrait forms: several pictures per character for transformations, each named, switched
  by tapping a thumbnail.
- **Status screen (future):** one place to review active status effects, buffs and debuffs, their sources and remaining duration; not implemented yet.
- **Temporary ability effects (next PR):** initial automatic Movement modifier in feet/AP, additive across active abilities. Activation needs a positive duration. Effective Movement is shown in teal for automatic ability bonuses (including the signed bonus in its source label); explicit manual Movement overrides stay orange and are edited as the unbuffed base. No permanent change to Movement or equipment. Turn start and manual End Effect remove temporary bonuses; battlemap movement uses the same effective speed.
- **Ability capacity and quick activation (next PR):** optional maximum active/held creations per ability, independent of limited uses and cooldowns. Successful activation increments held count by one until the configured maximum; a manual Release control lowers it. This count persists through rests and is not automatically changed by duration expiration. A compact Use action remains available while the card is collapsed or expanded.
- **Ability Library:** custom homebrew abilities with types, categories, favorites, text descriptions and notes, optional AP/resource costs, cooldown, duration and charge metadata (blank uses = unlimited; 0 uses = explicitly none available). Saved with character export/import, separate from the game; activation now supports spending AP/resource costs and tracking uses/cooldowns/durations; applying automatic effects remains future work. Export/Import/Clear character actions are accessible at the top of Sheet and Battlemap.
- **Custom resources:** characters can keep or hide the legacy Mana/Holy Power pool and add multiple independent named resources with stable IDs, maximum/current values, point or percent display, colors, turn recovery, long-rest refill toggles, and manual spending/restoring. Resource data stays in the character export. Ability cost integration is future work.
- **Health and Mana/Holy Power:** a Heal box, Death Threshold with a Trauma counter, and a dying panel (bleeding,
  Stabilized toggle, Indomitable roll, "Treated after combat"). Long rest refills everything, clears Trauma and has
  an undo.
- **Vitals:** Natural Evasion, Armor Rating, Initiative, Movement, Darkvision and Light carried, filled in from stats
  and gear; any can be typed over by hand.
- **Trackers:** AP, Reactions and Wonder, a "Start of my turn" button (refills AP and reactions, applies bleeding),
  Stabilize someone, Command an ally and Receive buttons (AP from a Command shows as its own green pips), and a
  Concentration toggle. A Movement panel spends AP on feet, keeps leftover feet and Surge's 2 free AP, and resets
  with Start of my turn.
- **Battlemap:** a second view (Sheet / Battlemap switch, link ends in `#map`). A grid of 5 ft squares labelled A1
  onward, 20 × 15 by default, resizable from 5 to 60 each way. Your token uses your portrait (initials without one).
  Drag it, tap a square twice, or use the arrow keys and Enter; moves spend AP through the Movement rules, with an
  Undo under the grid. Green shading shows squares you can reach without AP (leftover feet and Surge), brass the ones
  you can reach with your AP; a **Show where you can reach** checkbox turns the shading off. **Free placement** moves
  the token without spending AP, for setting up. The map is drawn in layers (map picture, terrain, grid lines with a
  strength slider, fog, shading), so no lines are baked into pictures.
  - **Maps:** Blank grid and a two-level sample ruin. Stone Hall (30 × 15, lit) has a pillared hall, a pool, a south
    entrance, an open door west into a ruined antechamber, and stairs going down. The Barrow under it (26 × 18, dark)
    has a burial hall with sarcophagi, a jarl's tomb on a dais, braziers, a sealed ring door, a corridor of burial
    niches (two of the dead have glowing eyes) and a flooded side crypt with glowing fungus. Standing on stairs pops
    up a prompt (Go down / Go up) that switches level. Terrain letters: # wall, O pillar, B broken pillar, r rubble,
    w water, b bones, s stairs, d open door, x sealed door, c sarcophagus, n burial niche, f brazier, u urns.
    **Show walls and terrain** reveals that layer. Map data and lighting live in `js/maps.js`; the pictures are drawn
    by the Python scripts in `maptools/`, not image generation, with lighting that walls block.
  - **Fog of war** (on by default for maps with walls): you see the squares next to you plus anything in a straight
    line of sight that's lit or within your sight in the dark (Darkvision and Light carried are on the sheet, and the
    map has a Light picker). Walls, pillars, sealed doors and burial niches block sight; sarcophagi, braziers, urns,
    rubble and broken pillars don't. Squares you've seen stay dimmed and are saved per map; "Hide explored areas
    again" resets them.
  - **Moving:** moves are planned on what you know: squares you haven't seen count as open floor and only enemies you
    can see are in the way. The token walks square by square (about 0.13 s a square) with the fog clearing and the
    view centered on it; if something turns up on the way, you stop next to it and only pay for the distance walked.
    The note under the map says when an enemy comes into view.
  - **Enemies:** Add enemy (name, Health, Evasion, Armor Rating), then tap squares to place them (the fog lifts while
    placing; repeats are numbered, like Draugr 1 and Draugr 2). A roster under the map edits or removes them, and
    dragging an enemy moves it for free. Tapping one targets it: a panel shows distance, Health, Evasion and Armor
    Rating, with an attack button per weapon (and one for both) at the sheet's AP cost; out of reach, it points to
    the nearest square to attack from. The roll is checked against Evasion, and damage minus Armor Rating can be
    taken off their Health, with Undo.
- **Dice mode:** a Disadvantage / Normal / Advantage toggle fixed at the bottom of the screen; every d20 uses it,
  Wonder rerolls included.
- **Defenses:** all damage comes in here. "Take the hit" applies resistance and Armor Rating with no reaction;
  "Armor doesn't apply" skips it; "Protecting an ally" (shield or Parry) lets you Block or Parry for them; "Natural
  20" turns Dodge off. Rolls with a known DC (Stabilize, Indomitable, Concentration) show success or failure.
- **Stats:** roller (drag or tap rolls onto stats), tap a stat to roll it, milestone popups, brass highlight at 28,
  gear shown in green. At levels 4, 8, 12, 16 and 19, + and − buttons spend the 4 points (max 2 per stat), with a
  reset.
- **Equipment:** Diablo-style paper doll, Forge, Equipped list and Pack. Attack cards per weapon (Attack, Damage,
  Opportunity attack, with Range) and a Dual wield card when both hands hold one-handers. Arm, leg and ring pieces
  can be forged as a set.
- **Advancement:** per-level table, plus a record of each level-up's stat increases with Change, Reset and Reset all.
- **Footer:** Export character, Import character, Clear sheet.

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
- Standing enemies block movement through and onto their square, as in D&D. Downed ones can be walked past but not
  stood on.
- A weapon reaches 5 ft unless its Range says otherwise, and needs line of sight; the square next to you always
  counts as in sight. A both-hands attack needs the target in reach of both weapons.
- Against an enemy on the map, Armor Rating comes off each hit separately (the off-hand after halving).
- Gear can add to Darkvision; light from gear and light carried don't stack (the larger counts).
- Attacks need a clear line to the target, not light.
- The Barrow's light sources match its picture: braziers 20 ft, daylight on the stairs 15 ft, glowing fungus 10 ft,
  candles in the niches and the sealed door's glow 5 ft.

## Direction: customizable characters

The eight stats, AP and homebrew combat framework remain the default. The site should support unique character resources and abilities rather than require standard D&D classes and spells. The future ability builder will support cooldowns, duration, optional resource/AP costs, multiple forms, and eventual targeted sheet effects. These are not implemented yet.

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

See [ROADMAP.md](ROADMAP.md).
