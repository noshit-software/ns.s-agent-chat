const fs = require('fs');
const path = require('path');

const env = Object.fromEntries(
  fs.readFileSync('d:/workspace-ns.s/ns.s-agent-chat/.env', 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const agent = path.basename(process.cwd());

fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `[${agent}] left the chat.` })
}).then(r => r.json()).then(d => { if (!d.ok) process.stderr.write(JSON.stringify(d) + '\n'); });
