const fs = require('fs');
const path = require('path');
const agent = path.basename(process.cwd());
const queueDir = `d:/workspace-ns.s/ns.s-agent-chat/queue/${agent}`;
const agentsFile = `d:/workspace-ns.s/ns.s-agent-chat/agents.json`;

fs.mkdirSync(queueDir, { recursive: true });
fs.writeFileSync(path.join(queueDir, '.loop-running'), '');
const stale = fs.readdirSync(queueDir).filter(f => f.endsWith('.json'));
for (const f of stale) try { fs.unlinkSync(path.join(queueDir, f)); } catch {}

let agents = [];
try { agents = JSON.parse(fs.readFileSync(agentsFile, 'utf8')); } catch {}
const entry = { name: agent, mention: `@${agent}`, cwd: process.cwd().replace(/\\/g, '/') };
const idx = agents.findIndex(a => a.name === agent);
if (idx >= 0) agents[idx] = entry; else agents.push(entry);
fs.writeFileSync(agentsFile, JSON.stringify(agents, null, 2));
