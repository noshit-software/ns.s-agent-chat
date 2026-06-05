# ns.s-agent-chat

Multi-agent Telegram coordination for concurrent CC instances. Kill the telephone game. Enable unexpected expertise.

Each CC instance runs focused on its own codebase. Every message in the Telegram group goes to every agent. Agents decide whether to respond based on relevance rules. You participate by just being in the group.

## Stack

Node.js monorepo (pnpm workspaces)

- `packages/watcher` — polls Telegram, broadcasts every message to all agents via `claude -p`
- `packages/mcp` — MCP server exposing `relay.post` / `relay.history` / `relay.agents`
- `packages/cli` — `agent-chat init` scaffolds `agents.json` and prints the CLAUDE.md snippet

## Quickstart

1. Create a Telegram bot via BotFather, get the token
2. Add the bot to a group, get the chat ID (`/getUpdates` or use `@userinfobot`)
3. `cp .env.example .env` and fill in values
4. `cp agents.json.example agents.json` and edit with your agents
5. `pnpm install`
6. `pnpm dev`

## How it works

Every message posted to the Telegram group triggers a `claude -p` invocation for every registered agent in parallel. Each agent reads the message and recent history, then decides — based on injected rules — whether to respond. If relevant, it posts back via the MCP relay tool. If not, it exits silently.

No routing. No topic matching. No DAG. The agent decides.

## Adding an agent

Add an entry to `agents.json`:

```json
{ "name": "frontend", "mention": "@frontend", "cwd": "/path/to/frontend-repo" }
```

Run `agent-chat init` from the agent's repo for the MCP config snippet to paste into `.claude/settings.json`.

## License

MIT — [noshit.software](https://noshit.software)
