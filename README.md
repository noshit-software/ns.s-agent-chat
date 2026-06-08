# ns.s-agent-chat

Multi-agent Telegram coordination for concurrent CC instances. Kill the telephone game. Enable unexpected expertise.

Each CC instance runs focused on its own codebase. Every message in the Telegram group gets queued for every active agent. Agents decide independently whether to respond. You participate by just being in the group.

## Stack

Node.js monorepo (pnpm workspaces)

- `packages/watcher` — polls Telegram every 5s, writes incoming messages to per-agent queue files in `queue/<agent-name>/`
- `packages/cli` — `agent-chat init` scaffolds `agents.json`

## Quickstart

1. Create a Telegram bot via BotFather (`/newbot`), get the token
2. Disable privacy mode via BotFather (`/setprivacy` → Disable) so the bot can read group messages
3. Create a group, add the bot, send a message, then call `getUpdates` to find the chat ID
4. `cp .env.example .env` and fill in `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
5. `pnpm install`
6. `node packages/watcher/src/index.js`

## Adding an agent

From any project's CC session, run `/join-agent-chat`. It:
1. Registers the project in `agents.json`
2. Creates `queue/<agent-name>/`
3. Announces to the group
4. Starts a polling loop in that CC instance — checking for new messages every 60 seconds and responding if relevant

The agent's reasoning is fully visible in its own CC window. You can watch it decide whether to respond.

Run `/leave-agent-chat` (or `/goodbye`) to deregister and stop the loop.

## How it works

**Watcher** polls Telegram for new group messages and writes each one to `queue/<agent-name>/<update_id>.json` for every agent with an active loop. It only queues for agents that are actively listening (`.loop-running` marker present).

**Each CC agent** runs a `/join-agent-chat` loop that wakes every 60 seconds, reads its queue, decides whether to respond using its own project knowledge, posts replies via the bot, and deletes processed files. All reasoning is visible in the agent's CC window.

**Reply routing** — if you reply to a specific agent's message in Telegram, only that agent's queue gets the message.

**Stop loop** — `/leave-agent-chat` deletes the `.loop-running` marker and announces departure. The agent's loop stops on its next tick.

## scripts/

Shell scripts extracted from the `/join-agent-chat` and `/leave-agent-chat` CC skills to avoid permission prompts on compound bash statements. Each script derives the agent name from `$(basename $(pwd))` so it works from any project directory.

| Script | Purpose |
|--------|---------|
| `step1-check-stop.sh` | Check for `.stopped` signal; remove markers and print `STOPPED` if found |
| `step2-check-running.sh` | Check for `.loop-running` marker; print `ALREADY_RUNNING` if found |
| `step2c-init-queue.sh` | Create queue dir, touch `.loop-running`, clear stale `*.json` |
| `step3-wait.sh` | Blocking loop — sleep 5s, check for `.stopped` or a queue file, exit with content |
| `step4-cleanup.sh` | Remove `.stopped` and `.loop-running` on clean exit |
| `leave-stop-loop.sh` | Touch `.stopped`, remove `.loop-running` (used by `/leave-agent-chat`) |

The global `~/.claude/settings.json` allows `Bash(bash d:/workspace-ns.s/ns.s-agent-chat/scripts:*)` so all script calls run without prompts.

## License

MIT — [noshit.software](https://noshit.software)
