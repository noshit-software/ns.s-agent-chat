import 'dotenv/config'
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { resolve, join } from 'path'

// Single-instance guard via PID file
const PID_FILE = resolve(process.cwd(), '.watcher.pid')
if (existsSync(PID_FILE)) {
  const existingPid = parseInt(readFileSync(PID_FILE, 'utf8').trim())
  try {
    process.kill(existingPid, 'SIGTERM')
    console.log(`[watcher] killed existing instance (PID ${existingPid}), taking over`)
  } catch {
    console.log(`[watcher] stale PID file (${existingPid}), taking over`)
  }
}
writeFileSync(PID_FILE, String(process.pid))
process.title = 'ns.s-watcher'
const cleanupPid = () => { try { unlinkSync(PID_FILE) } catch {} }
process.on('exit', cleanupPid)
process.on('SIGINT', () => process.exit())
process.on('SIGTERM', () => process.exit())

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS ?? 5000)
const HISTORY_LIMIT = Number(process.env.HISTORY_LIMIT ?? 10)
const CATCHUP_WINDOW_MS = Number(process.env.CATCHUP_WINDOW_MS ?? 60000)

if (!BOT_TOKEN) throw new Error('Missing required env var: TELEGRAM_BOT_TOKEN')
if (!CHAT_ID) throw new Error('Missing required env var: TELEGRAM_CHAT_ID')

const AGENTS_FILE = process.env.AGENTS_FILE ?? resolve(process.cwd(), 'agents.json')
const QUEUE_DIR = resolve(process.cwd(), 'queue')
const LOG_FILE = resolve(process.cwd(), 'activity.log')
const STATE_FILE = resolve(process.cwd(), '.relay-state.json')

let state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { lastUpdateId: 0 }
const cutoffTime = Date.now() - CATCHUP_WINDOW_MS

const recentMessages = []

function log(line) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const entry = `[${ts}] ${line}\n`
  process.stdout.write(entry)
  appendFileSync(LOG_FILE, entry)
}

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

function loadAgents() {
  if (!existsSync(AGENTS_FILE)) return []
  try { return JSON.parse(readFileSync(AGENTS_FILE, 'utf8')) } catch { return [] }
}

function isLoopActive(agentName) {
  return existsSync(join(QUEUE_DIR, agentName, '.loop-running'))
}

function writeQueueFile(agentName, updateId, from, text, history) {
  const agentQueueDir = join(QUEUE_DIR, agentName)
  mkdirSync(agentQueueDir, { recursive: true })
  const file = join(agentQueueDir, `${updateId}.json`)
  writeFileSync(file, JSON.stringify({ id: updateId, from, text, history, timestamp: Date.now() }))
}

async function poll() {
  try {
    const updates = await fetchUpdates(state.lastUpdateId + 1)
    const agents = loadAgents()

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

      const replyText = msg.reply_to_message?.from?.is_bot ? msg.reply_to_message.text : null
      const replyAgentMatch = replyText?.match(/^\[([^\]]+)\]:/)
      const candidates = replyAgentMatch
        ? agents.filter(a => a.name === replyAgentMatch[1])
        : agents

      // Only queue for agents with an active loop
      const activeAgents = candidates.filter(a => isLoopActive(a.name))

      if (activeAgents.length === 0) continue

      log(`[watcher] "${msg.text.slice(0, 60)}" → queuing for ${activeAgents.map(a => a.name).join(', ')}`)

      for (const agent of activeAgents) {
        writeQueueFile(agent.name, update.update_id, from, msg.text, history)
      }
    }

    writeFileSync(STATE_FILE, JSON.stringify(state))
  } catch (err) {
    log(`[watcher] poll error: ${err.message} ${err.cause?.message ?? ''} ${err.cause?.code ?? ''}`)
  }
}

// Reload agents list on each tick — picks up new agents without restart
console.log(`[agent-chat] watcher started — polling every ${POLL_INTERVAL}ms — queue: ${QUEUE_DIR}`)
setInterval(poll, POLL_INTERVAL)
poll()
