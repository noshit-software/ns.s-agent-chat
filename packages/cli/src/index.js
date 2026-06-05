#!/usr/bin/env node
import { writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const [,, command] = process.argv

if (command === 'init') {
  const agentsFile = resolve(process.cwd(), 'agents.json')
  if (!existsSync(agentsFile)) {
    const example = [
      { name: 'agent1', mention: '@agent1', cwd: '/path/to/repo1' },
      { name: 'agent2', mention: '@agent2', cwd: '/path/to/repo2' }
    ]
    writeFileSync(agentsFile, JSON.stringify(example, null, 2))
    console.log('✓ Created agents.json — edit it to register your agents')
  } else {
    console.log('agents.json already exists — skipping')
  }

  console.log(`
Add this to each agent's .claude/settings.json:

{
  "mcpServers": {
    "agent-chat-relay": {
      "command": "node",
      "args": ["/path/to/ns.s-agent-chat/packages/mcp/src/index.js"],
      "env": {
        "TELEGRAM_BOT_TOKEN": "<your-bot-token>",
        "TELEGRAM_CHAT_ID": "<your-chat-id>",
        "AGENTS_FILE": "/path/to/agents.json",
        "AGENT_NAME": "<this-agent-name>"
      }
    }
  }
}

Add this to each agent's CLAUDE.md:

## agent-chat

You are participating in a multi-agent coordination channel via Telegram.
Your domain is this codebase. Stay in your lane.

Rules:
- Read relay history before responding to any cross-agent message.
- If the message is not relevant to your domain, do not respond.
- If it's already been answered, do not pile on.
- Be concise — chat, not docs.
- Use @mentions to address agents or @human when you need a human.
- Post responses via relay.post(body).

Tools: relay.post(body) | relay.history(limit?) | relay.agents()
`)
} else {
  console.log('Usage: agent-chat init')
  process.exit(1)
}
