/* Oct 31 Notion export; direct DM overrides take precedence. Data only. */
window.WBRulesCatalog={
  "statuses": {
    "Bleeding": "at the start of its turn, it takes 1d4 damage, plus 1d4 for each of levels 5, 10, 15 and 20 reached by the creature that caused it. Armor Rating doesn't reduce it. Any healing or a successful Shake It Off (DC 12) ends it. Bleeding doesn't stack.",
    "Blinded": "fails all ability checks that require sight. Has disadvantage on attack rolls and Dodges, and attack rolls against it have advantage.",
    "Burning": "at the start of its turn, it takes 1d6 fire damage, plus 1d6 for each of levels 5, 10, 15 and 20 reached by the creature that set it alight. Armor Rating doesn't reduce it. Ending it with Shake It Off requires a VIT roll against the effect DC (base 5 AP, VIT discount). Entering water ends it.",
    "Charmed": "can't attack the charmer or target it with harmful effects. The charmer has advantage on rolls to interact with the charmed creature.",
    "Deafened": "fails all ability checks that require hearing.",
    "Frightened": "has disadvantage on attack rolls and ability checks while the source of its fear is in its line of sight, and can't willingly move closer to it.",
    "Grappled": "can't move. Escaping costs 5 AP and a Strength or Dexterity check against 12 + the grappler's Strength modifier.",
    "Incapacitated": "can't spend AP or take reactions.",
    "Invisible": "can't be seen without magic or a special sense. Attack rolls against it have disadvantage, and its attack rolls have advantage.",
    "Paralyzed": "incapacitated. Attack rolls against it have advantage, and any attack that hits it from within 5ft is a critical hit.",
    "Petrified": "it and all non-magical objects it's wearing are turned to stone. It's incapacitated, resistant to all damage and immune to new status effects.",
    "Poisoned": "has disadvantage on attack rolls and ability checks.",
    "Prone": "moving costs twice as much AP, and standing up costs 5 AP. Has disadvantage on attack rolls. Melee attack rolls against it have advantage, and ranged attack rolls against it have disadvantage.",
    "Restrained": "can't move. Has disadvantage on attack rolls and Dodges, and attack rolls against it have advantage.",
    "Stunned": "incapacitated, and attack rolls against it have advantage.",
    "Unconscious": "incapacitated and prone, and drops whatever it's holding. Attack rolls against it have advantage. It wakes when its Health rises to 1 or more. If something other than damage knocked it out, taking damage also wakes it."
  },
  "equipment": [
    {
      "name": "Battleaxe",
      "type": "onehand",
      "dmg": "1d8",
      "damageType": "Slashing",
      "properties": [
        "Balanced",
        "Light"
      ],
      "signatures": [
        "Sweep"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "12 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Chakram",
      "type": "onehand",
      "dmg": "1d6",
      "damageType": "Slashing",
      "properties": [
        "Finesse",
        "Thrown"
      ],
      "signatures": [
        "Bleed"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "35 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 5,
      "thrownRange": 30,
      "thrownLongRange": 60
    },
    {
      "name": "Dagger",
      "type": "onehand",
      "dmg": "1d4",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Light",
        "Thrown"
      ],
      "signatures": [
        "Concealed",
        "Quickdraw"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "6 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5,
      "thrownRange": 20,
      "thrownLongRange": 40
    },
    {
      "name": "Flail",
      "type": "onehand",
      "dmg": "1d8",
      "damageType": "Bludgeoning",
      "properties": [
        "Balanced"
      ],
      "signatures": [
        "Disarm"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "12 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Flanged Mace",
      "type": "onehand",
      "dmg": "1d10",
      "damageType": "Bludgeoning",
      "properties": [
        "Heavy"
      ],
      "signatures": [
        "Stagger"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "20 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Handaxe",
      "type": "onehand",
      "dmg": "1d6",
      "damageType": "Slashing",
      "properties": [
        "Balanced",
        "Light",
        "Thrown"
      ],
      "signatures": [
        "Quickdraw"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "8 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5,
      "thrownRange": 20,
      "thrownLongRange": 40
    },
    {
      "name": "Iron Fan",
      "type": "onehand",
      "dmg": "1d6",
      "damageType": "Slashing",
      "properties": [
        "Finesse",
        "Light"
      ],
      "signatures": [
        "Concealed",
        "Disarm"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "40 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Javelin",
      "type": "onehand",
      "dmg": "1d8",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Thrown"
      ],
      "signatures": [
        "Pierce Through"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "10 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5,
      "thrownRange": 30,
      "thrownLongRange": 60
    },
    {
      "name": "Katana",
      "type": "onehand",
      "dmg": "1d8",
      "damageType": "Slashing",
      "properties": [
        "Finesse",
        "Versatile"
      ],
      "signatures": [
        "Bleed"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "50 gc",
      "stat": "DEX",
      "versatileDice": "1d10",
      "range": 5
    },
    {
      "name": "Kusarigama",
      "type": "onehand",
      "dmg": "1d8",
      "damageType": "Slashing",
      "properties": [
        "Finesse"
      ],
      "signatures": [
        "Hook",
        "Sweep"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "40 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Light Hammer",
      "type": "onehand",
      "dmg": "1d6",
      "damageType": "Bludgeoning",
      "properties": [
        "Balanced",
        "Light",
        "Thrown"
      ],
      "signatures": [
        "Stagger"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "8 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5,
      "thrownRange": 20,
      "thrownLongRange": 40
    },
    {
      "name": "Longsword",
      "type": "onehand",
      "dmg": "1d8",
      "damageType": "Slashing",
      "properties": [
        "Balanced",
        "Versatile"
      ],
      "signatures": [],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "15 gc",
      "stat": "STR",
      "versatileDice": "1d10",
      "range": 5
    },
    {
      "name": "Mace",
      "type": "onehand",
      "dmg": "1d6",
      "damageType": "Bludgeoning, Piercing",
      "properties": [
        "Balanced"
      ],
      "signatures": [
        "Sunder"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "8 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Main-gauche",
      "type": "onehand",
      "dmg": "1d4",
      "damageType": "Piercing",
      "properties": [
        "Finesse",
        "Light"
      ],
      "signatures": [
        "Disarm"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "30 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Morningstar",
      "type": "onehand",
      "dmg": "1d8",
      "damageType": "Bludgeoning",
      "properties": [
        "Balanced",
        "Light"
      ],
      "signatures": [
        "Stagger"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "12 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Quarterstaff",
      "type": "onehand",
      "dmg": "1d6",
      "damageType": "Bludgeoning",
      "properties": [
        "Balanced",
        "Versatile"
      ],
      "signatures": [],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "5 gc",
      "stat": "STR",
      "versatileDice": "1d8",
      "range": 5
    },
    {
      "name": "Rapier",
      "type": "onehand",
      "dmg": "1d10",
      "damageType": "Piercing",
      "properties": [
        "Finesse"
      ],
      "signatures": [
        "Puncture"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "40 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Scimitar",
      "type": "onehand",
      "dmg": "1d8",
      "damageType": "Slashing",
      "properties": [
        "Balanced",
        "Light"
      ],
      "signatures": [
        "Bleed"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "12 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Shortsword",
      "type": "onehand",
      "dmg": "1d6",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Light"
      ],
      "signatures": [
        "Puncture"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "10 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Sickle",
      "type": "onehand",
      "dmg": "1d6",
      "damageType": "Slashing",
      "properties": [
        "Balanced",
        "Light",
        "Thrown"
      ],
      "signatures": [
        "Hook"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "6 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5,
      "thrownRange": 20,
      "thrownLongRange": 40
    },
    {
      "name": "Spear",
      "type": "onehand",
      "dmg": "1d8",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Thrown"
      ],
      "signatures": [
        "Bulwark"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "10 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5,
      "thrownRange": 20,
      "thrownLongRange": 40
    },
    {
      "name": "Trident",
      "type": "onehand",
      "dmg": "1d8",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Thrown"
      ],
      "signatures": [
        "Disarm"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "15 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5,
      "thrownRange": 20,
      "thrownLongRange": 40
    },
    {
      "name": "Urumi",
      "type": "onehand",
      "dmg": "1d8",
      "damageType": "Slashing",
      "properties": [
        "Finesse",
        "Reach"
      ],
      "signatures": [
        "Sweep"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "45 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "War Axe",
      "type": "onehand",
      "dmg": "1d10",
      "damageType": "Slashing",
      "properties": [
        "Heavy"
      ],
      "signatures": [
        "Sunder"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "20 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "War Pick",
      "type": "onehand",
      "dmg": "1d8",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Light"
      ],
      "signatures": [
        "Sunder"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "12 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Whip",
      "type": "onehand",
      "dmg": "1d4",
      "damageType": "Slashing",
      "properties": [
        "Balanced",
        "Light",
        "Reach"
      ],
      "signatures": [
        "Disarm"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "8 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Glaive",
      "type": "twohand",
      "dmg": "1d10",
      "damageType": "Slashing",
      "properties": [
        "Heavy",
        "Reach",
        "Two-handed"
      ],
      "signatures": [
        "Hook"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "22 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Greataxe",
      "type": "twohand",
      "dmg": "1d12",
      "damageType": "Slashing",
      "properties": [
        "Heavy",
        "Two-handed"
      ],
      "signatures": [
        "Sunder"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "25 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Greatclub",
      "type": "twohand",
      "dmg": "1d10",
      "damageType": "Bludgeoning",
      "properties": [
        "Balanced",
        "Two-handed"
      ],
      "signatures": [
        "Stagger"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "8 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Greatsword",
      "type": "twohand",
      "dmg": "2d6",
      "damageType": "Slashing",
      "properties": [
        "Heavy",
        "Two-handed"
      ],
      "signatures": [
        "Sweep"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "25 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Halberd",
      "type": "twohand",
      "dmg": "1d10",
      "damageType": "Slashing",
      "properties": [
        "Heavy",
        "Reach",
        "Two-handed"
      ],
      "signatures": [
        "Sweep"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "22 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Lance",
      "type": "twohand",
      "dmg": "2d10",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Reach",
        "Mount",
        "Two-handed"
      ],
      "signatures": [],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "60 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Maul",
      "type": "twohand",
      "dmg": "2d6",
      "damageType": "Bludgeoning",
      "properties": [
        "Heavy",
        "Two-handed"
      ],
      "signatures": [
        "Stagger"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "25 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Naginata",
      "type": "twohand",
      "dmg": "1d12",
      "damageType": "Slashing",
      "properties": [
        "Finesse",
        "Reach",
        "Two-handed"
      ],
      "signatures": [
        "Sweep"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "55 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Pike",
      "type": "twohand",
      "dmg": "1d10",
      "damageType": "Piercing",
      "properties": [
        "Heavy",
        "Reach",
        "Two-handed"
      ],
      "signatures": [
        "Bulwark"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "20 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "War Scythe",
      "type": "twohand",
      "dmg": "2d6",
      "damageType": "Slashing",
      "properties": [
        "Heavy",
        "Reach",
        "Two-handed"
      ],
      "signatures": [
        "Hook"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "28 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Warhammer",
      "type": "twohand",
      "dmg": "1d10",
      "damageType": "Bludgeoning",
      "properties": [
        "Balanced",
        "Two-handed"
      ],
      "signatures": [
        "Sunder"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "12 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Zweihänder",
      "type": "twohand",
      "dmg": "2d8",
      "damageType": "Slashing",
      "properties": [
        "Heavy",
        "Two-handed"
      ],
      "signatures": [
        "Sweep"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "30 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Blowgun",
      "type": "onehand",
      "dmg": "1",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Ranged"
      ],
      "signatures": [
        "Silent",
        "Concealed"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "5 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 20,
      "longRange": 40
    },
    {
      "name": "Dart",
      "type": "onehand",
      "dmg": "1d4",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Thrown",
        "Ranged"
      ],
      "signatures": [
        "Quickdraw"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "5 sc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 20,
      "longRange": 40
    },
    {
      "name": "Sling",
      "type": "onehand",
      "dmg": "1d4",
      "damageType": "Bludgeoning",
      "properties": [
        "Balanced",
        "Ranged"
      ],
      "signatures": [
        "Silent"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "5 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 30,
      "longRange": 60
    },
    {
      "name": "Shortbow",
      "type": "twohand",
      "dmg": "1d6",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Two-handed",
        "Ranged"
      ],
      "signatures": [
        "Silent"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "15 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 60,
      "longRange": 120
    },
    {
      "name": "Longbow",
      "type": "twohand",
      "dmg": "1d8",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Two-handed",
        "Ranged"
      ],
      "signatures": [
        "Pierce Through"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "25 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 90,
      "longRange": 180
    },
    {
      "name": "Hand Crossbow",
      "type": "onehand",
      "dmg": "1d10",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Strapped",
        "Loading",
        "Ranged"
      ],
      "signatures": [
        "Concealed"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "35 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 30,
      "longRange": 60,
      "loadingCapacity": 1
    },
    {
      "name": "Light Crossbow",
      "type": "onehand",
      "dmg": "2d6",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Loading",
        "Ranged"
      ],
      "signatures": [
        "Puncture"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "40 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 60,
      "longRange": 120,
      "loadingCapacity": 1
    },
    {
      "name": "Crossbow",
      "type": "twohand",
      "dmg": "2d10",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Two-handed",
        "Loading",
        "Ranged"
      ],
      "signatures": [],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "75 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 80,
      "longRange": 160,
      "loadingCapacity": 1
    },
    {
      "name": "Revolver",
      "type": "onehand",
      "dmg": "1d6",
      "damageType": "Piercing",
      "properties": [
        "Balanced",
        "Loading",
        "Ranged"
      ],
      "signatures": [
        "Loud",
        "Quickdraw"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "100 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 30,
      "longRange": 60,
      "loadingCapacity": 6
    },
    {
      "name": "Net",
      "type": "onehand",
      "dmg": "0",
      "damageType": "",
      "properties": [
        "Balanced",
        "Thrown",
        "Ranged"
      ],
      "signatures": [
        "Entangle"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "10 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 15,
      "longRange": 15
    },
    {
      "name": "Katar",
      "type": "onehand",
      "dmg": "1d8",
      "damageType": "Piercing",
      "properties": [
        "Paragon",
        "Light"
      ],
      "signatures": [
        "Puncture",
        "Quickdraw"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "100 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Odachi",
      "type": "twohand",
      "dmg": "2d8",
      "damageType": "Slashing",
      "properties": [
        "Paragon",
        "Two-handed"
      ],
      "signatures": [
        "Bleed",
        "Sweep"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "140 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Guandao",
      "type": "twohand",
      "dmg": "2d6",
      "damageType": "Slashing",
      "properties": [
        "Paragon",
        "Two-handed",
        "Reach"
      ],
      "signatures": [
        "Sweep",
        "Hook"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "130 gc",
      "stat": "STR",
      "versatileDice": "",
      "range": 5
    },
    {
      "name": "Warbow",
      "type": "twohand",
      "dmg": "2d8",
      "damageType": "Piercing",
      "properties": [
        "Paragon",
        "Two-handed",
        "Ranged"
      ],
      "signatures": [
        "Pierce Through"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "130 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 120,
      "longRange": 240
    },
    {
      "name": "Arbalest",
      "type": "twohand",
      "dmg": "3d12",
      "damageType": "Piercing",
      "properties": [
        "Paragon",
        "Two-handed",
        "Loading",
        "Ranged"
      ],
      "signatures": [
        "Puncture"
      ],
      "ar": 0,
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "150 gc",
      "stat": "DEX",
      "versatileDice": "",
      "range": 100,
      "longRange": 200,
      "loadingCapacity": 1
    },
    {
      "name": "Light chest",
      "type": "torso",
      "ar": 1,
      "lightEvasion": 0,
      "armorWeight": "light",
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "6 gc"
    },
    {
      "name": "Medium chest",
      "type": "torso",
      "ar": 1,
      "lightEvasion": 0,
      "armorWeight": "medium",
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "8 gc"
    },
    {
      "name": "Heavy chest",
      "type": "torso",
      "ar": 2,
      "lightEvasion": 0,
      "armorWeight": "heavy",
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "15 gc"
    },
    {
      "name": "Medium helmet",
      "type": "head",
      "ar": 1,
      "lightEvasion": 0,
      "armorWeight": "medium",
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "5 gc"
    },
    {
      "name": "Heavy helmet",
      "type": "head",
      "ar": 1,
      "lightEvasion": 0,
      "armorWeight": "heavy",
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "8 gc"
    },
    {
      "name": "Light arm guards",
      "type": "arms",
      "ar": 0,
      "lightEvasion": 1,
      "armorWeight": "light",
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "3 gc",
      "pair": true
    },
    {
      "name": "Medium arm guards",
      "type": "arms",
      "ar": 1,
      "lightEvasion": 0,
      "armorWeight": "medium",
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "5 gc",
      "pair": true
    },
    {
      "name": "Heavy arm guards",
      "type": "arms",
      "ar": 1,
      "lightEvasion": 0,
      "armorWeight": "heavy",
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "8 gc",
      "pair": true
    },
    {
      "name": "Light pants",
      "type": "pants",
      "ar": 0,
      "lightEvasion": 1,
      "armorWeight": "light",
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "2 gc"
    },
    {
      "name": "Heavy pants",
      "type": "pants",
      "ar": 1,
      "lightEvasion": 0,
      "armorWeight": "heavy",
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "8 gc"
    },
    {
      "name": "Light leg guards",
      "type": "legs",
      "ar": 0,
      "lightEvasion": 1,
      "armorWeight": "light",
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "3 gc",
      "pair": true
    },
    {
      "name": "Medium leg guards",
      "type": "legs",
      "ar": 1,
      "lightEvasion": 0,
      "armorWeight": "medium",
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "5 gc",
      "pair": true
    },
    {
      "name": "Heavy leg guards",
      "type": "legs",
      "ar": 1,
      "lightEvasion": 0,
      "armorWeight": "heavy",
      "abilities": [],
      "bonuses": [],
      "effects": [],
      "price": "8 gc",
      "pair": true
    },
    {
      "name": "Wooden shield",
      "type": "shield",
      "block": "1d6",
      "ar": 0,
      "price": "5 gc",
      "abilities": [],
      "bonuses": [],
      "effects": []
    },
    {
      "name": "Chain shield",
      "type": "shield",
      "block": "1d8",
      "ar": 0,
      "price": "15 gc",
      "abilities": [],
      "bonuses": [],
      "effects": []
    },
    {
      "name": "Scale shield",
      "type": "shield",
      "block": "1d10",
      "ar": 0,
      "price": "25 gc",
      "abilities": [],
      "bonuses": [],
      "effects": []
    },
    {
      "name": "Plate shield",
      "type": "shield",
      "block": "1d10",
      "ar": 1,
      "price": "60 gc",
      "abilities": [],
      "bonuses": [],
      "effects": []
    }
  ],
  "signatures": {
    "Sweep": "a hit also strikes one other creature in your reach for half damage, rounded down.",
    "Hook": "on a hit, you can pull the target 5ft toward you.",
    "Stagger": "on a hit, the target makes a Vitality save against 12 + the modifier you attacked with. On a failure, it loses 2 AP on its next turn.",
    "Disarm": "on a hit, the target makes a Strength or Dexterity save against 12 + the modifier you attacked with. On a failure, it drops a weapon it's holding.",
    "Entangle": "a creature it hits is Restrained until it escapes. Trying to escape costs 5 AP and a DC 12 Strength or Dexterity check.",
    "Puncture": "its hits ignore 2 of the target's Armor Rating. On a Two-handed weapon, halve the Armor Rating first, then ignore 2 more.",
    "Sunder": "on a hit, the target makes a Strength save against 12 + the modifier you attacked with. On a failure, its armor's Armor Rating drops by 1 until it's repaired. You can't lower a target's armor by more than the modifier you attack with.",
    "Bleed": "a hit makes the target start Bleeding (see [Status Effects Explained](Status%20Effects%20Explained%20351c72092efb812098ded266c9753a38.md)).",
    "Pierce Through": "a ranged hit carries on to the next creature in a straight line behind the target, dealing it half damage, rounded down.",
    "Bulwark": "you can spend a reaction to attack a creature that moves into your reach.",
    "Quickdraw": "drawing, stowing or swapping to it costs 0 AP.",
    "Concealed": "easy to hide on your body. Your first attack with it from hiding has advantage.",
    "Silent": "attacking with it doesn't give away where you are.",
    "Loud": "every attack with it can be heard from far away."
  }
};
