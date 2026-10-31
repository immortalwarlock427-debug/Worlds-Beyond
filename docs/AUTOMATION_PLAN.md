# Character Automation — Technical Specification and Implementation Plan

**Status:** staged, in development. **Resource commands, AP/Mana payments and atomic ability/form selection are implemented.** An automatic/manual trigger engine, form `effects`, arbitrary overcharge caps and a rule editor **do not exist yet**. This document is the shared plan for the DM, ChatGPT, Claude and Codex. Read [CONTEXT.md](CONTEXT.md) for gameplay decisions, [ARCHITECTURE.md](ARCHITECTURE.md) for actual module boundaries, and [CODEX_START_HERE.md](CODEX_START_HERE.md) for the immediate implementation task.

**Goal:** let players create unusual homebrew class mechanics without adding bespoke JavaScript for every class. Keep character editing trust-based. Do **not** treat the Rage/Monstrous Form example as a special case.

## 1. What is confirmed vs. still a choice

**Confirmed by the DM**
- Each rule/ability can be configured for **automatic or manual activation**. Manual uses an explicit control; automatic reacts to a defined trigger. Don't force every technique to activate automatically.
- Use a reusable, data-driven system for custom resources, named forms, abilities and their effects. Preserve existing form-linked portraits, worn gear, costs, ability visibility, cooldowns, durations and custom-resource membership.
- Automations must be predictable, editable and safe for unusual classes. Avoid anti-cheat or hardcoded class templates.
- Design for future in-person multiplayer: DM computer/phone and each player's own phone; the current DM encounter is an offline snapshot, not a live shared character.

**Recommended by Claude; not individually approved yet**
- Store rule configuration **on existing abilities**, rather than adding a separate rules collection. The initial editor should have a two-way Manual/Automatic selector. Supporting *both* simultaneously for one ability is a future UX option, not a locked requirement.
- Manual numerical edits are **corrections**, not gameplay events; they do not fire automations. Restore/Gain, damage, turn start and ability activation do.
- Automatic entry into a form **skips its configured AP/resource entry cost by default**; an individual Enter Form action can explicitly opt in to paying that cost.
- Threshold conditions fire on **false → true** or **true → false** transitions rather than on every change while already satisfied. Enabling a rule or reloading never itself causes a trigger.
- An automatic rule whose requirements/costs are not met does nothing and emits an explanation; it never partially spends.
- For maximum decreases, default to the legacy `lose excess` policy; offer per-resource `keep excess` when this feature is implemented.

**Open DM decisions — do not silently settle**
1. **Rage model:** (A) base maximum 100 with an **absolute hard cap** of 200, and Monstrous Form gives +100 *effective maximum*; (B) maximum 200 in all forms with a marker/trigger threshold at 100. Option A supports real overflow; option B is simpler but displays 80/200 in Base.
2. **On leaving the form above 100:** always lose points, always keep them, or make it configurable per resource (the flexible option is recommended). Distinguish a temporary *maximum drop* from simply displaying the bar.
3. **Typed manual edits and automation:** never trigger (recommended), or allow opt-in per rule.
4. **Automatic form-entry costs:** skip by default (recommended) or require payment by default; regardless, allow explicit per-action override eventually.
5. **Automatic and manual simultaneously on one ability:** support a third `Both` value now or defer it. The DM confirmed a *choice* between Automatic/Manual, not a required third mode.

Do not block independent infrastructure PRs on these choices. Mark a rule-dependent default as **provisional** in docs/tests until the DM answers.

## 2. Existing implementation — verify before every PR

- `js/character-core.js` exposes pure `WBCharacter.derive(state)` and `WBCharacter.apply(state, command)` for custom resources, AP and built-in Mana/Holy Power payments/corrections. `SpendPools` validates AP and Mana together; the transaction plans form-entry payment before switching worn gear. `ActivateAbility`, `EnterForm` and `SelectPortrait` now include AP/Mana/custom costs, ability trackers/effects and form/portrait/equipment selection in one private-state transaction. Health, turn/rest, manual corrections and undo orchestration still remain.
- `js/resources.js` routes Spend, Restore, Fill, current/max edits, regeneration, long-rest refill and max reconciliation through the first command boundary. Loading and rendering no longer clamp a valid current value above base maximum. With an active +100 resource-max ability effect, 150/200 survives reload; when that duration expires via the New Turn path, its max/current can return to 100. **No configurable hard cap or overcharge policy exists.**
- `js/abilities.js` retains the reusable named-form, activation and effect rules. The live Use/selection controllers execute `WBCharacter` transactions that reuse those helpers; they do not mutate the live character through them directly. Existing form `statBonuses` are not a general form-effects array; only active ability effects currently change resource max.
- `js/app.js` reads AP/Mana payment values through the pure character derivation and applies command patches; it still owns Health, turn/long-rest orchestration, portrait controls and per-feature undo. `WBEncounter.applyAction` is the existing deterministic *offline encounter* command boundary; it is not the character automation engine.
- `cloud.html` provides **manual** private Supabase character copies; offline `dm.html` operates on snapshots, so changing DM Health does not currently emit character damage events. Do not claim automatic multiplayer support.

## 3. Core architecture and invariants

**Pure derivation:** `WBCharacter.derive(state)` must compute effective scores, maxima, resource balances, AP/Mana/Health inputs required by conditions without accessing DOM or writing to state. Use existing `WBCombat`, `WBAbilities` and equipment computations rather than fork the formulas. Numeric fields currently stored as strings must be normalized for derived reads. Separate `baseMax`, `effectiveMax`, and eventual `hardCap`.

**Typed commands:** extend `WBCharacter.apply(state, command, context?) → {ok, state, events, log, error?}` incrementally. Command types must express user intent (gain/spend/set resource, spend AP/Mana, activate ability, enter form, damage/heal, new turn, long rest). Prefer expected revision and unique command IDs when integrating cloud/multiplayer; current local commands must be replayable without `Date.now()` or `Math.random()` in the kernel. Dice and IDs arrive as command inputs. Reject invalid commands without mutating state or spending partial costs.

**Single mutation boundary:** after each domain migrates, UI handlers and rule actions must call the **same commands**. Do not retain a parallel mutation path in a second UI or in automation. Integrate one domain per PR; do not rewrite all ~225 KB of `app.js` at once.

**Events:** commands produce documented domain events, ideally with `previous`, `current`, entity ID, source, and command/chain identity. Rendering, loading, importing, saving, rehydration, background refreshes and editing rule configuration do not dispatch gameplay events. A manual correction is identified separately from a gain/spend action. Do not trigger on UI re-renders.

**Atomicity:** validate all AP, Mana, resource, usage, cooldown and form-entry costs before changing any value. A failed action must leave form, portrait, gear, AP, resources, uses, cooldowns and active effects exactly as before. Preserve free-to-Base and no-charge-for-same-form behavior.

**Ongoing modifiers vs. one-time actions:** abilities already derive temporary effects while `durationLeft > 0`. Later forms should have an `effects` array using compatible targets (stat, Armor Rating, Evasion, Movement, resource maximum) and derive them **while active**. Never implement "increase max 100 when entering, subtract 100 when leaving" as paired imperative actions; portrait/manual/trigger entry must all produce the same derived modifier.

**Unknown data and versioning:** preserve existing character-v1 exports and browser-save keys unless a planned migration is necessary. Before adding new targets/triggers, audit `normalizeEffect` and other normalizers: older/stale JS may rewrite unknown effect targets to `none` and save away unsupported data. Design a forward-compatible schema guard or explicit read-only/unsupported warning; **do not** silently strip unknown fields from a newer character and overwrite its cloud copy. Test imports, local reload and cloud restore expectations.

**Safety:** no imported JavaScript, expressions or user-authored code execution. Whitelist known events, predicates and actions; validate IDs/types/limits. Automation modifies the *own character only* until shared encounter authority exists. User customization is allowed, but shared ownership/role and conflict-safe writes still need server enforcement.

## 4. Resource semantics and overflow (Stage B)

- **Base maximum:** user-configured ordinary value (for example Rage 100).
- **Effective maximum:** base plus currently active derived form/ability modifiers (for example Monstrous +100 → 200). No free points are granted merely by increasing maximum.
- **Absolute hard cap (proposed):** explicit resource-level upper bound for intentional overflow, never an offset such as "+100 above effective maximum" that grows again when the form changes. Legacy resources should default to behavior that doesn't unexpectedly allow overcharge.
- **Current:** can legitimately exceed the **base** maximum when boosted by an effect. Never truncate during load, normalization, render, import or cloud restore. Eventually allow intentional overflow up to hard cap according to DM choice.
- **Gain/Restore and rule-generated gains:** may add points up to whichever absolute cap and growth policy the DM chooses. **Do not make a new rule-specific gain implementation.**
- **Turn regeneration and Fill:** stop at effective maximum if below it. If current already exceeds effective maximum, do not silently lower it; Fill/regen cannot grow unbounded beyond the effective maximum.
- **Maximum falls (effect ends, form exit, base max edit):** apply a *per-resource policy once in the command that changed the maximum*, not from rendering. Default currently resembles "lose excess"; configurable "keep excess" is a proposed extension. Keep the difference between the **absolute cap** and the **effective max** explicit.
- **Long rest:** expand legacy `refillOnRest` boolean to Fill/Empty/Unchanged per resource, preserving existing characters' behavior by default. Define whether Fill means base or effective maximum; existing long rest fills to base max. This is an open compatibility decision for the implementation PR, not a license to change existing saves silently.
- **Display:** show the current/max numerically, including values above ordinary maximum, and eventually show a threshold marker / overflow segment for percent bars. An overcharged pool must never be silently represented only as "100%".
- **Form/resource availability:** a hidden pool preserves its balance and can be explicitly referenced by an entry cost; its visibility and its value are distinct.

**Example — not a special code path:** IF Rage crosses above base maximum THEN Enter Monstrous Form. The form's active effects derive a larger effective maximum. Reverse transformation is a separate condition/duration/manual form choice, not an automatic paired decrement.

## 5. Ability rules: triggers, requirements and actions (Stages C/D)

**Storage (proposed shape, not a fixed JSON schema yet):** extend `state.abilities[]` with optional `activationMode`, `trigger`, `requirements[]` and `actions[]`. Old abilities with none retain their current Use-button semantics and existing form/cost/duration behavior. New fields are declarative and versioned. Prefer adding behavior within the Ability Library editor over a second standalone Rules list.

**Manual activation:** click the existing Use control, check requirements and existing AP/Mana/custom-resource costs, charges and cooldown, then atomically execute the action sequence. If requirements fail, show a clear explanation without changing anything.

**Automatic activation:** when a matching gameplay event or a condition crossing occurs, check availability, requirements, cooldowns, charges and any configured costs; if unaffordable, do not fire and record why. A rule should not fire repeatedly merely because the condition remains true. Optional "Both" mode is pending DM approval. Do not introduce a modal confirmation that pauses an automated chain; optional reactions can be suggested/highlighted later.

**Initial state triggers:**
- Resource current relative to a fixed amount, its **base** maximum, its **effective** maximum, or a percent (base/effective denominator must be explicit).
- Health relative to a fixed value or percent of maximum.
- Form identity / currently in named form.
- Direction `becomes true` or `becomes false`, using before/after snapshots from a real command. Operators should be explicit: `>`, `>=`, `<`, `<=`, `==`, `!=`; boundary checks such as "exceeds 100" mean `> 100` (100 itself does not trigger).

**Initial event triggers:** new turn, long rest, form entered, form left, ability used, effect ended, damage taken. Include enough payload to support event-bound actions (e.g. amount damaged) and distinguish one actual event from a repeated view update. Events like hit, crit and kill are deferred.

**Initial requirements:** reuse those comparisons, with **AND** between requirements. OR groups can wait. Evaluate when a rule executes, not just when queued, so earlier rules that spend a resource can invalidate later ones.

**Initial own-character actions:**
- Gain, spend or set custom resources (fixed value; optionally a bounded multiplier of the triggering event amount, such as 0.5× damage).
- Enter a named form or return to Base, using the existing form-switch command including portrait/gear updates. Whether to pay form-entry costs is an explicit action option (defaults pending DM approval).
- Start/end an ability's timed effect using the current duration machinery.
- Add/remove a status using the existing status module.
- Do not implement other-character damage, healing, tokens, attacks, rolls, dynamic formulas or DM commands in this phase.

**Reversion:** model "drop below 50 Rage → Base", "effect expires → Base", and a manual Base switch as ordinary triggers/actions. Avoid a bespoke revert subsystem.

**Execution order and recursion:**
1. Apply user/DM command atomically and derive its events/crossings.
2. Add matching rule activations to a FIFO queue; use stable order from the ability list for multiple matches.
3. When dequeuing, recheck current requirements, availability, cooldowns and costs. Apply a matching rule as a normal command/transaction, append its new events and log.
4. Track ancestry/visited rule IDs **per causal chain** to block A → B → A cycles while allowing independent later events to trigger that same rule. Cap the total number of automated actions/queue steps (suggestion: 100) with an explanatory error rather than silent looping.
5. If two rules legitimately switch to different forms, execution order determines the final form; explain both in the log. Clearly specify whether earlier costs persist (expected: yes if the rule was validly executed).
6. One top-level command and all nested automation are saved together. Implement a single transaction-level Undo; keep a small memory-only history (suggested ~10) without duplicating multi-megabyte portrait images.
7. A **Test / dry run** button evaluates a copy, shows the full log, and does not alter character state, resources, cooldowns or saved revision.

## 6. Editor, feedback and testing

Inside the existing Ability Library card, expose optional Requirements, automatic/manual selection, Trigger, and ordered Actions in a readable sentence-style UI. Provide enable/disable, cost policy, validation, a Test button and an activity log. Keep it usable on phones (test 390px width). Avoid ambiguous terms like "greater than max" without specifying **base** vs **effective** max.

Provide direct, plain-language feedback on success, rejection, skipped activation, cost/refusal and cycle prevention. Example hypothetical log:
`Gain +20 Rage → 120 (base max 100) → Monstrous Awakening crossed >100 → entered Monstrous Form → effective Rage maximum 200`.

**Regression scenarios (add to Node and Playwright as appropriate):**
- Rage at 100 does not fire; change 100 → 120 fires **once**; change 120 → 130 does **not** retrigger. Going below and above again can fire again.
- Manual mode never fires on an automatic crossing; manual Use checks the same costs, uses and cooldowns as before.
- Both AP and a resource are unaffordable: **nothing** changes; portrait/form/gear preserved.
- A rule's action causes another rule; A → B → A terminates and logs suppression; two independent events can trigger A twice.
- Two rules for the same event run deterministically in stable list order, with requirements rechecked.
- Rest, effect expiry, form change, regen, resource gain/spend, and max drop give correct values; legacy reload, import and cloud restore keep valid above-base points.
- Render/load, manual correction (subject to DM choice), and enabling a pre-satisfied trigger do not accidentally activate a rule.
- Undo reverses the entire command + generated actions; dry-run changes nothing.
- Unknown/unimplemented rule targets are preserved or guarded without overwriting user data, including an older-browser/stale-cache scenario.
- DM Room continues working independently; no false claim that offline encounter HP is live character HP.

## 7. Delivery order and PR boundaries

**A. Resource commands — MERGED (PR #35).** A first pure `WBCharacter` resource command/derive slice, resource UI migration, and 150/200 persistence regression test. Existing abilities/forms/AP still use separate paths. Do not redo A.

**B1. AP/Mana payment foundation — IMPLEMENTED:** DOM-free AP/Mana derivation and payment/correction commands preserve null/full trackers, Command-first spending, manual values and form-aware Mana availability. Ability/form callbacks use an atomic AP/Mana payment plan; form costs are derived from the source gear profile before a successful switch. Node and 390px browser tests cover purity, rejects, visibility, legacy values, source-profile payment and export/reload. Turn/rest/undo orchestration and the entire ability/form transaction are not migrated by this step.

**B2. Ability/form transaction slice — IMPLEMENTED:** runtime Use and named-form/portrait selection now commit combined AP/Mana/custom costs, charges/capacity, cooldown/duration, gear and portrait changes atomically, with deterministic whole-transaction events. Existing helpers operate on a private copy; failed steps publish nothing. Health, turn/rest, broader manual tracker controls and transaction-level Undo remain subsequent focused slices. The already-decided AP discounts can now build on this activation path without a second cost formula.

**B3. After DM's resource choices:** add form `effects`, hard caps/overflow policy/rest policy, forward-compatible schema migration and threshold display; test all forms/portraits. Do not add Rage-specific settings.

**C. Trigger engine:** pure state crossings + event dispatch + AND requirements + deterministic queue/guard/actions; test thoroughly. Keep editor changes out of this PR.

**D. Ability editor:** wire Automatic/Manual choice, validation, dry-run, feedback and log. Build immediately after C, so the feature becomes usable. The C/D PRs may be developed consecutively, but review both before expecting players to configure triggers.

**E. Later:** OR logic, optional reaction suggestions, encounter-owned rule actions, multi-device synchronization, templates, combat-hit/crit/kill events and advanced formulas.

**Separate tracked feature:** custom ability **stat-based AP discounts** are already decided: None/STR/DEX/INT/FTH (None default); effective AP = `max(ceil(base AP / 2), base AP − current effective stat modifier)`, negative modifiers raise cost. Integrate with one ability-activation command and all card/`Usable now`/filter calculations, avoiding a second AP computation path. The timing relative to B2 is a planning decision, not a reason to silently skip this feature.

## 8. Definition of done for every coding PR

- Branch from latest `main`, one narrowly scoped `codex/<task>` PR; **never auto-merge**.
- Read `AGENTS.md`, `CONTEXT.md`, `ARCHITECTURE.md`, this plan and `CODEX_START_HERE.md`. Verify actual code before trusting older design notes.
- Preserve old local saves, v1 character export, manually uploaded cloud characters, named forms, effects, gear and same-browser DM preview.
- Run all `node --test tests/*.test.cjs` checks plus Playwright/390px browser tests; add tests for new semantics; no weakening assertions to make them pass.
- Avoid rendering-side mutation, hidden auto-triggers or surprise changes to the DM's homebrew rules.
- Update statuses/roadmap **in place**, remove contradictory "not implemented" claims when a feature ships, and explain affected behavior and manual preview steps in the PR description.
- Wait for the DM to test and merge before starting the next dependent task.
