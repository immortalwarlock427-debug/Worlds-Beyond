# Working on Worlds Beyond

Read `README.md` and `docs/ARCHITECTURE.md` first. The full rules context (core rules, sheet assumptions, open
design questions) is in the pinned doc "Worlds Beyond: Context for a New Chat" on claude.ai
(https://claude.ai/artifact/TD8M51dFyYpF1XghQkezsM, read it with the Claude Docs tools); the rules themselves are in
Notion under D&D > Game Systems (https://app.notion.com/p/351c72092efb8089812cd231debc3e74). Weavecasting is a separate magic system: don't mix its rules in.

- The sheet should follow the rules, but everything should stay resettable or changeable in case someone messes up.
- When a rule changes, update Notion, the site and the context doc to match.
- Critically evaluate ideas: flag contradictions, redundancies, exploits, unnecessary rules and knock-on effects.
  Don't invent extra restrictions unless they're actually necessary. Write multipliers as 1.5× or 150%.
- Keep the character and the game apart (see the two saves in `docs/ARCHITECTURE.md`).
- No build step: test by serving the folder (`python3 -m http.server`) and opening it in a browser, at phone width
  too. `python3 tools/build_single.py` makes the one-file version for the Claude artifact.
- Bump "Draft N" in `index.html` with each round of changes.
