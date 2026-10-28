# Working on Worlds Beyond

These instructions are for any AI assistant working on this repository (Claude, GPT/Codex or others).

Read these first:
1. `docs/CONTEXT.md`: the rules summary, how I want you to work, the sheet's assumptions, open design questions.
   It's the main copy of the project context.
2. `README.md` and `docs/ARCHITECTURE.md`: what the site is and how the code and saves fit together.
3. `docs/ROADMAP.md`: what's next.

The rules themselves are in Notion under D&D > Game Systems
(https://app.notion.com/p/351c72092efb8089812cd231debc3e74). Weavecasting is a separate magic system: don't mix its
rules in.

- The sheet should follow the rules, but everything should stay resettable or changeable in case someone messes up.
- When a rule changes, update Notion, the site and `docs/CONTEXT.md` to match.
- Critically evaluate ideas: flag contradictions, redundancies, exploits, unnecessary rules and knock-on effects.
  Don't invent extra restrictions unless they're actually necessary. Write multipliers as 1.5× or 150%.
- Keep the character and the game apart (see the two saves in `docs/ARCHITECTURE.md`).
- No build step: test by serving the folder (`python3 -m http.server`) and opening it in a browser, at phone width
  too. `python3 tools/build_single.py` makes the one-file version for the Claude artifact.
- Bump "Draft N" in `index.html` with each round of changes, and keep the "What the site does" section of
  `docs/CONTEXT.md` up to date.
- Commit with the GitHub no-reply email (`immortalwarlock427-debug@users.noreply.github.com`); GitHub rejects pushes
  that would publish a private email.
