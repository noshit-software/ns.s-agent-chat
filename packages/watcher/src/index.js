import 'dotenv/config'
import { spawn } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname, join } from 'path'

// Convert MSYS/Git Bash paths (/d/foo) to Windows paths (D:\foo) for child_process cwd
function toNativePath(p) {
  return p.replace(/^\/([a-zA-Z])\//, '$1:/').replace(/\//g, '\\')
}

// Invoke claude CLI directly via node — avoids shell quoting issues with complex prompts
const NODE = process.execPath
const CLAUDE_CLI = join(dirname(NODE), 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')

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
Your domain is the codebase at ${agent.cwd}.

You must respond with ONLY valid JSON in this exact format — no other text, no markdown, no explanation:
{"post": true, "message": "your response here"}
or
{"post": false}

Rules:
- Set "post" to false if: the message is not relevant to your domain; another agent already answered adequately; you only agree or have nothing new to add; you would just be restating what's already in the history.
- Set "post" to true only if you have something genuinely NEW or useful that hasn't been said.
- When posting: be concise (max 3-4 sentences), use @mentions when addressing someone.
- If blocked, post and @human.
- Default to silence. Only speak when you have something that matters.

Recent history:
${history || '(none yet)'}

New message:
${messageText}`
}

async function postToTelegram(text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text })
  })
}

function dispatchAgent(agent, prompt) {
  return new Promise((resolve) => {
    const chunks = []
    const errChunks = []
    const { CLAUDECODE, CLAUDE_CODE_SESSION_ID, CLAUDE_CODE_ENTRYPOINT, ...baseEnv } = process.env
    const proc = spawn(NODE, [CLAUDE_CLI, '--print'], {
      cwd: toNativePath(agent.cwd),
      env: { ...baseEnv, AGENT_NAME: agent.name }
    })
    proc.stdin.write(prompt)
    proc.stdin.end()
    proc.on('error', (err) => { console.error(`[${agent.name}] spawn error:`, err.message); resolve() })
    proc.stdout.on('data', chunk => chunks.push(chunk))
    proc.stderr.on('data', chunk => errChunks.push(chunk))
    proc.on('close', async (code) => {
      if (code && code !== 0) {
        const errOut = Buffer.concat(errChunks).toString().trim()
        console.error(`[${agent.name}] exited with code ${code}${errOut ? ': ' + errOut.slice(0, 200) : ''}`)
      }
      const raw = Buffer.concat(chunks).toString().trim()
      let message = null
      const jsonMatch = raw.match(/\{[^{}]*"post"\s*:[^{}]*\}/s)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.post === true && parsed.message) message = parsed.message
        } catch { /* malformed — stay silent */ }
      } else if (raw) {
        message = raw
      }
      if (message) {
        await postToTelegram(`[${agent.name}]: ${message}`)
        recentMessages.push({ from: agent.name, text: message })
        if (recentMessages.length > 50) recentMessages.shift()
      }
      resolve()
    })
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

      // If replying to a bot message, only dispatch the agent that sent it
      const replyText = msg.reply_to_message?.from?.is_bot ? msg.reply_to_message.text : null
      const replyAgentMatch = replyText?.match(/^\[([^\]]+)\]:/)
      const targetAgents = replyAgentMatch
        ? agents.filter(a => a.name === replyAgentMatch[1])
        : agents

      console.log(`[watcher] "${msg.text.slice(0, 60)}" → ${targetAgents.length === agents.length ? `broadcasting to ${agents.length}` : `replying to ${targetAgents.map(a => a.name).join(', ')}`}`)

      await Promise.all(targetAgents.map(agent => dispatchAgent(agent, buildPrompt(agent, msg.text, history))))
    }

    writeFileSync(STATE_FILE, JSON.stringify(state))
  } catch (err) {
    console.error('[watcher] poll error:', err.message, err.cause?.message ?? '', err.cause?.code ?? '')
  }
}

console.log(`[agent-chat] watcher started — ${agents.length} agents — polling every ${POLL_INTERVAL}ms`)
setInterval(poll, POLL_INTERVAL)
poll()
