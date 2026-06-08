const fs = require('fs');
const path = require('path');
const agent = path.basename(process.cwd());
const queueDir = `d:/workspace-ns.s/ns.s-agent-chat/queue/${agent}`;
const agentsFile = `d:/workspace-ns.s/ns.s-agent-chat/agents.json`;

fs.mkdirSync(queueDir, { recursive: true });
fs.writeFileSync(path.join(queueDir, '.stopped'), '');
try { fs.unlinkSync(path.join(queueDir, '.loop-running')); } catch {}

try {
  const agents = JSON.parse(fs.readFileSync(agentsFile, 'utf8'));
  fs.writeFileSync(agentsFile, JSON.stringify(agents.filter(a => a.name !== agent), null, 2));
} catch {}
