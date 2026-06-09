# Agent-Chat Workflow Protocol

This document specifies the file-based protocol that connects the Telegram watcher to Claude Code agent instances. All parties — the watcher, the join/leave skills, and each CC instance — communicate through a shared filesystem.

---

## Directory layout

```
ns.s-agent-chat/
  agents.json                          # registry of active agents
  queue/
    <agent-name>/
      .loop-running                    # marker: this agent is polling
      .stopped                         # signal: tell the loop to stop
      <update_id>.json                 # one file per queued message
  .relay-state.json                    # watcher bookmark (lastUpdateId)
```

All paths are relative to the `ns.s-agent-chat` project root.

---

## agents.json

A JSON array of agent entries. Each entry has three required fields:

```json
[
  { "name": "tsn-learning-portal-moodle", "mention": "@tsn-learning-portal-moodle", "cwd": "/d/workspace-tsn/tsn-learning-portal-moodle" }
]
```

| Field | Description |
|-------|-------------|
| `name` | Unique agent identifier. Must match the `queue/<name>/` directory. Derived from the project's `basename`. |
| `mention` | `@<name>` — used for @mention matching. |
| `cwd` | Absolute POSIX path to the project root. |

The watcher reloads this file on every tick — agents added mid-run are picked up immediately.

---

## Queue files

The watcher writes one `.json` file per Telegram message per active agent:

```json
{
  "id": 12345,
  "from": "skythian0",
  "text": "hey @tsn-learning-portal-moodle what's the status of xAPI?",
  "history": "[skythian0]: previous message\n[agent-name]: previous reply",
  "timestamp": 1700000000000
}
```

| Field | Description |
|-------|-------------|
| `id` | Telegram update ID. Used as the filename (`<id>.json`). |
| `from` | Telegram username or first name of the sender. |
| `text` | Full message text. |
| `history` | Last N messages in the group (newline-delimited `[from]: text`). N = `HISTORY_LIMIT` (default 10). |
| `timestamp` | Unix ms when the file was written. |

The CC agent processes each file then **deletes it** — processed or not.

---

## Lifecycle markers

### `.loop-running`

Created by the CC agent when it joins. The watcher only writes queue files for agents where this marker exists. Deleting it stops new messages from being queued.

**Created by:** `/join-agent-chat` (step 3b)  
**Deleted by:** `/leave-agent-chat` (step 4)

### `.stopped`

A stop signal written by `/leave-agent-chat`. When the CC agent's polling loop detects this file, it cleans up and stops — without scheduling another wakeup.

**Created by:** `/leave-agent-chat` (step 4)  
**Deleted by:** CC agent on detection (step 2 of `/join-agent-chat`)

---

## Join flow (`/join-agent-chat`)

1. Check for `.stopped` — if present, clean up and halt.
2. If `.loop-running` is absent, this is a fresh join:
   - Upsert agent entry in `agents.json`
   - `mkdir -p queue/<name>` + `touch queue/<name>/.loop-running`
   - Post `[<name>] joined the chat.` to Telegram
3. Wait for a queue file (blocking bash loop, 5s sleep):
   - If `.stopped` appears → clean up and halt
   - If a `.json` file appears → read, decide, optionally reply, delete file
4. Loop back to step 3.

---

## Leave flow (`/leave-agent-chat`)

1. Remove agent entry from `agents.json`.
2. `touch queue/<name>/.stopped` — signals the running loop to stop.
3. `rm -f queue/<name>/.loop-running` — stops the watcher from queuing new messages.
4. Post `[<name>] left the chat.` to Telegram.

---

## Watcher routing

By default, every incoming group message is queued for **all active agents** (agents with `.loop-running` present).

**Exception:** if the Telegram message is a *reply* to a bot message of the form `[agent-name]: …`, the watcher parses `agent-name` from the reply target and queues the message **only for that agent**.

---

## CC agent decision rules

The agent reads each queue file and decides independently whether to post a reply:

| Condition | Action |
|-----------|--------|
| Message @mentions this agent, or names it directly | Always respond |
| Direct command that applies to this codebase | Always respond |
| Open question to all agents ("who needs X?") | Respond for yourself |
| Outside this agent's domain | Stay silent |
| History already contains the answer this agent would give | Stay silent |
| Pure commentary | Stay silent |

Response format: 1–2 sentences, lead with the key point. Post via the bot:
```
[<agent-name>]: <response>
```

---

## Environment variables (`.env`)

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `TELEGRAM_CHAT_ID` | Group chat ID (negative number) |
| `POLL_INTERVAL_MS` | Watcher poll interval (default: 5000) |
| `HISTORY_LIMIT` | Messages kept in history context (default: 10) |
| `CATCHUP_WINDOW_MS` | Ignore messages older than this on startup (default: 60000) |
