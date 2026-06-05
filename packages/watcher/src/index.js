import 'dotenv/config'
import { execFile } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS ?? 5000)
const HISTORY_LIMIT = Number(process.env.HISTORY_LIMIT ?? 10)
const CATCHUP_WINDOW_MS = Number(process.env.CATCHUP_WINDOW_MS ?? 60000)

if (!BOT_TOKEN) throw new Error('Missing required env var: TELEGRAM_BOT_TOKEN')
if (!CHAT_ID) throw new Error('Missing required env var: TELEGRAM_CHAT_ID')

const AGENTS_FILE = process.env.AGENTS_FILE ?? resolve(process.cwd(), 'agents.json')
if (!existsSync(AGENTS_FILE)) throw new Error(`agents.json not found at ${AGENTS_FILE} — run: agent-chat init`)
const agents = JSON.parse(readFileSync(AGENTS_FILE, 'utf8'))

const STATE_FILE = resolve(process.cwd(), '.relay-state.json')
let state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { lastUpdateId: 0 }
const cutoffTime = Date.now() - CATCHUP_WINDOW_MS

// In-memory recent history (Telegram bot API has no reliable history endpoint)
const recentMessages = []

async function fetchUpdates(offset) {
  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=0&allowed_updates=%5B%22message%22%5D`
  )
  const data = await res.json()
  if (!data.ok) throw new Error(`Telegram API error: ${JSON.stringify(data)}`)
  return data.result
}

function buildHistory() {
  return recentMessages
    .slice(-HISTORY_LIMIT)
    .map(m => `[${m.from}]: ${m.text}`)
    .join('\n')
}

function buildPrompt(agent, messageText, history) {
  return `You are the ${agent.name} agent in a multi-agent platform chat.
Your domain is the codebase at ${agent.cwd}. Stay in your lane.

Rules:
- Read the recent message history below before deciding anything.
- If this message is not relevant to your domain, exit silently — output nothing, post nothing.
- If the message has already been answered adequately by another agent in history, do not pile on — exit silently.
- Be concise. This is a chat, not a doc. Max 3-4 sentences unless detail is explicitly requested.
- Use @mentions to address specific agents or @human when you need the human.
- If you are blocked and cannot resolve, say so clearly and @human.
- Never re-summarize what was already said. Just respond.
- If you have something to say, post it to the Telegram channel using: relay.post(body)

Recent history:
${history || '(none yet)'}

New message:
${messageText}`
}

function dispatchAgent(agent, prompt) {
  return new Promise((resolve) => {
    execFile(
      'claude',
      ['-p', prompt, '--allowedTools', 'mcp__agent-chat-relay__post,mcp__agent-chat-relay__history,mcp__agent-chat-relay__agents'],
      { cwd: agent.cwd, env: { ...process.env, AGENT_NAME: agent.name } },
      (err) => {
        if (err?.code) console.error(`[${agent.name}] exited with code ${err.code}`)
        resolve()
      }
    )
  })
}

async function poll() {
  try {
    const updates = await fetchUpdates(state.lastUpdateId + 1)

    for (const update of updates) {
      state.lastUpdateId = update.update_id
      const msg = update.message
      if (!msg?.text) continue
      if (msg.from?.is_bot) continue
      if ((msg.date * 1000) < cutoffTime) continue

      const from = msg.from?.username ?? msg.from?.first_name ?? 'unknown'
      recentMessages.push({ from, text: msg.text })
      if (recentMessages.length > 50) recentMessages.shift()

      const history = buildHistory()
      console.log(`[watcher] "${msg.text.slice(0, 60)}" → broadcasting to ${agents.length} agents`)

      await Promise.all(agents.map(agent => dispatchAgent(agent, buildPrompt(agent, msg.text, history))))
    }

    writeFileSync(STATE_FILE, JSON.stringify(state))
  } catch (err) {
    console.error('[watcher] poll error:', err.message)
  }
}

console.log(`[agent-chat] watcher started — ${agents.length} agents — polling every ${POLL_INTERVAL}ms`)
setInterval(poll, POLL_INTERVAL)
poll()
