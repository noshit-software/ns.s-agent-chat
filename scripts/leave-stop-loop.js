const fs = require('fs');
const path = require('path');
const agent = path.basename(process.cwd());
const queueDir = `d:/workspace-ns.s/ns.s-agent-chat/queue/${agent}`;
fs.mkdirSync(queueDir, { recursive: true });
fs.writeFileSync(path.join(queueDir, '.stopped'), '');
try { fs.unlinkSync(path.join(queueDir, '.loop-running')); } catch {}
