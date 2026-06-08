const fs = require('fs');
const path = require('path');
const agent = path.basename(process.cwd());
const queueDir = `d:/workspace-ns.s/ns.s-agent-chat/queue/${agent}`;
fs.mkdirSync(queueDir, { recursive: true });
fs.writeFileSync(path.join(queueDir, '.loop-running'), '');
const stale = fs.readdirSync(queueDir).filter(f => f.endsWith('.json'));
for (const f of stale) try { fs.unlinkSync(path.join(queueDir, f)); } catch {}
