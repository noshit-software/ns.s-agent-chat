#!/usr/bin/env node
import 'dotenv/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

if (!BOT_TOKEN) throw new Error('Missing required env var: TELEGRAM_BOT_TOKEN')
if (!CHAT_ID) throw new Error('Missing required env var: TELEGRAM_CHAT_ID')

const AGENTS_FILE = process.env.AGENTS_FILE ?? resolve(process.cwd(), 'agents.json')
const AGENT_NAME = process.env.AGENT_NAME ?? 'agent'

const server = new McpServer({ name: 'agent-chat-relay', version: '0.1.0' })

server.tool(
  'post',
  { body: z.string().describe('Message to post to the Telegram group') },
  async ({ body }) => {
    const text = `[${AGENT_NAME}]: ${body}`
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text })
    })
    const data = await res.json()
    if (!data.ok) return { content: [{ type: 'text', text: `Failed: ${JSON.stringify(data)}` }] }
    return { content: [{ type: 'text', text: 'Posted.' }] }
  }
)

server.tool(
  'history',
  { limit: z.number().optional().describe('Number of recent messages (default 10)') },
  async ({ limit = 10 }) => {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-${limit * 3}&allowed_updates=%5B%22message%22%5D`
    )
    const data = await res.json()
    if (!data.ok) return { content: [{ type: 'text', text: `Failed: ${JSON.stringify(data)}` }] }
    const messages = data.result
      .filter(u => u.message?.text && !u.message.from?.is_bot)
      .slice(-limit)
      .map(u => {
        const from = u.message.from?.username ?? u.message.from?.first_name ?? 'unknown'
        return `[${from}]: ${u.message.text}`
      })
      .join('\n')
    return { content: [{ type: 'text', text: messages || '(no recent messages)' }] }
  }
)

server.tool('agents', {}, async () => {
  if (!existsSync(AGENTS_FILE)) {
    return { content: [{ type: 'text', text: 'agents.json not found' }] }
  }
  const agents = JSON.parse(readFileSync(AGENTS_FILE, 'utf8'))
  const list = agents.map(a => `${a.mention} (${a.name}) — ${a.cwd}`).join('\n')
  return { content: [{ type: 'text', text: list }] }
})

const transport = new StdioServerTransport()
await server.connect(transport)
