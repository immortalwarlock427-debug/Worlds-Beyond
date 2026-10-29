# Character Automation — Proposed Architecture

**Design in progress.** Resource overcharge configuration and ongoing form modifiers are now implemented in a separate PR. Automatic transformation triggers and the rules editor are **not implemented yet**. Based on Claude's October 2026 architecture review and the DM's explicit choices.

## Confirmed principles

- Data-driven, class-agnostic homebrew; no arbitrary JavaScript from character files. Player choices remain trust-based.
- Each rule can be **Automatic or Manual**. Attach Requirements, Actions and optional Triggers to existing abilities, reusing their costs, cooldowns, uses, duration and form availability.
- Derive persistent *while-active* form/ability modifiers (including resource capacity) from current state; reserve one-time actions for gaining resources, entering forms or starting effects.
- State triggers fire when a condition **becomes true**, not for every update while it stays true. Event triggers use explicit turn/form/ability/damage events.
- No auto-trigger on render, load, import, edit/correction or enabling an already-satisfied rule by default; the correction policy remains a user choice.
- Deterministic command application with FIFO event queue, stable rule order, cycle guard, and hard action cap. No random/time-generated IDs inside the core. No multi-character changes until multiplayer ownership is designed.
- Manual and automatic actions should use the same command implementation. A whole command + its chained automation becomes one reversible transaction; keep small, memory-only undo history without copying large portrait blobs.

## Small, reviewable implementation milestones

1. **Character command foundation (underway):** pure `WBCharacter.derive(state)` and `WBCharacter.apply(state,command)`. First migrate resource gain/spend/set/fill, per-turn regeneration and rest. Fix legitimate above-base current values being destroyed during loading/rendering. Later migrate AP, Mana, form switching, ability activation, Health, turn/rest and unified undo (separate PRs). This first PR is **not** yet the authority for all sheet mutations.
2. **Resource/ability/form model:** form `effects` using existing ability effect targets; absolute resource caps, overflow-lowering policies and Fill/Empty/Unchanged rest options. Defaults preserve legacy behavior. Loading and drawing never clamp current values. Preserve unknown fields/schema versions to guard against stale browser clients.
3. **Rules engine + editor:** state crossings, events, AND conditions and own-character actions. Build manual/automatic ability controls and a dry-run Test/log UI in consecutive PRs.
4. **Later:** OR conditions, optional-reaction suggestions, encounter-owned actions, advanced formulas, templates and live multiplayer integration.

## Decisions the DM still needs to make

1. **Rage model — confirmed:** base maximum 100, absolute cap 200, Monstrous Form has a derived +100 Rage effective-maximum effect. This is true overcharge, not a fake always-200 resource.
2. **After maximum decreases — confirmed:** configurable **per resource**, with **lose excess** as the default; **keep excess** is optional. Absolute hard cap remains enforced on actual changes.
3. **Manual corrections — confirmed:** typing values **never fires automation**. State-crossing rules will only be evaluated after gameplay commands/events.
4. **Rule activation — confirmed:** a player chooses **Manual or Automatic** per rule/ability (with both supported when explicitly configured).
5. **Automatic form-entry costs — recommended, not yet approved:** skip configured AP/resource entry costs by default for involuntary automatic transitions, with an explicit per-action override to pay. This remains to confirm before trigger implementation.

Implementation guidance: a resource's explicit absolute cap bounds player Gain/Restore and direct corrections. Regeneration and Fill stop at effective maximum, not cap; overcharge can be gained through gameplay Gain/Restore. Rest behavior supports Fill to base, Empty, or Unchanged. Form modifiers are derived from current form, never separate actions that need manual removal. Loading and rendering never discard excess.
