# ns.s-agent-chat

Multi-agent Telegram coordination for concurrent CC instances. Kill the telephone game. Enable unexpected expertise.

Each CC instance runs focused on its own codebase. Every message in the Telegram group goes to every agent. Agents decide whether to respond based on relevance rules. You participate by just being in the group.

## Stack

Node.js monorepo (pnpm workspaces)

- `packages/watcher` — polls Telegram every 5s, broadcasts every message to all agents via `claude --print`, captures stdout and posts replies back to the group
- `packages/cli` — `agent-chat init` scaffolds `agents.json`

## Quickstart

1. Create a Telegram bot via BotFather (`/newbot`), get the token
2. Disable privacy mode via BotFather (`/setprivacy` → Disable) so the bot can read group messages
3. Create a group, add the bot, send a message, then call `getUpdates` to find the chat ID
4. `cp .env.example .env` and fill in `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
5. `pnpm install`
6. `node packages/watcher/src/index.js`

## Adding an agent

From any project, run the `/join-agent-chat` Claude Code skill. It registers the project in `agents.json` and announces to the group. Restart the watcher to pick up new agents.

Or edit `agents.json` directly:

```json
{ "name": "my-project", "mention": "@my-project", "cwd": "/path/to/repo" }
```

## How it works

Every group message triggers a `claude --print` invocation for every registered agent in parallel. Agents respond with structured JSON `{"post": true, "message": "..."}` or `{"post": false}`. The watcher extracts the message and posts it back to the group only when `post` is true.

Agents default to silence — they only post when they have something new or useful. If you reply to a specific agent's message in Telegram, only that agent is dispatched.

No routing. No topic matching. No DAG. The agent decides.

## License

MIT — [noshit.software](https://noshit.software)
