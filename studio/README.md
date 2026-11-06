# Studio Hub

Live board for the AI studio: https://claude.ai/artifact/DG8n5NbEiTmMVcK5oS4qTd. It's private to you; share it from the page's Share menu. It works on phones: the bottom tab bar is sized for one-handed use.

- `hub.html` is the page source. Republish it from a Claude Code session after edits.
- `org.json` holds the 7 teams and 30 agents, generated from `.claude/agents/*.md`.
- `projects.json` holds projects, tasks, owners, blockers and updates.

The live page reads from its own database (collections `teams`, `agents`, `projects`). The **producer** agent keeps
the JSON here and the live database in sync. Ticks, status changes and updates you make on your phone land in the
database, and the producer pulls them back into `projects.json`.
