# Working on Worlds Beyond

For Claude, Codex and other assistants. Read `docs/CONTEXT.md` **first** for current features, confirmed mechanics and in-person play, then `docs/ARCHITECTURE.md`, `README.md` and `docs/ROADMAP.md`. Full gameplay rules live in Notion → D&D > Game Systems. Weavecasting is separate.

- **Trust-based character sheet:** players may customize and correct values; don't add anti-cheat or unsolicited gameplay restrictions. Account privacy and safe shared writes still matter.
- Reflect actual rules in Notion, site and CONTEXT. Critically evaluate changes; explain contradictions and consequences. Use 1.5× or 150% notation.
- Keep local character and DM game repositories separate, preserving existing storage keys and v1 exports unless an explicit migration is approved.
- Serve locally without a build step (`python3 -m http.server`); test browsers/390px layouts and automated checks. Publish the one-file Claude artifact from merged `main` only.
- **Update documentation in place.** CONTEXT says what exists and what is decided, ROADMAP says what's next; do not append per-PR feature histories.
- For CSS/JS releases, bump shared cache query versions; keep Draft numbers aligned in CONTEXT/index at release time. Use the GitHub noreply email for commits.

## Two assistants, one repository

- Never edit `main` directly. Fetch the latest main and create `claude/<task>` or `codex/<task>`. Check other open PRs first. **One branch and PR per numbered roadmap item.**
- Prefix every commit and PR title with `Claude:` or `Codex:`, explaining **why**. Use **one commit per logical change**, not one per file.
- Don't force-push main, reset or discard another assistant's work. Work in separate clones/worktrees if sharing a machine.
- Preserve both intentions in noncontradictory conflicts; ask the DM before resolving conflicting game rules.
- Test before opening a PR; merge following user review/approval. Do not publish the Claude artifact from an unmerged branch.

## Engineering guardrails

- New shared rules live in DOM-free modules: `WBCombat` for combat, `WBAbilities` for form/ability effects and `WBEncounter.applyAction` for offline encounter commands. Use `WBPersistence` and `WBGameState` rather than duplicating browser saves.
- DM imports are **snapshots**, never live edits to player sheets. `game.encounter` actors/maps remain distinct from legacy `game.tokens`/foes. Movement actions must validate path, AP and current turn.
- The `player.html` view is a **same-browser demo**, not authenticated multi-device ownership. Future online sessions require secure membership and per-player filtered data; **plan first, build only with DM approval**.
- `cloud.html` uses the public Supabase config and owner-only RLS for **manual character copies**, not DM games. Never include service-role/secret keys in the client.
- Detailed implementation contracts, map/AP/actor rules, and future online boundaries belong in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/CLOUD_MULTIPLAYER_PLAN.md](docs/CLOUD_MULTIPLAYER_PLAN.md).
