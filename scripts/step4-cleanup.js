const fs = require('fs');
const path = require('path');
const agent = path.basename(process.cwd());
const queueDir = `d:/workspace-ns.s/ns.s-agent-chat/queue/${agent}`;
try { fs.unlinkSync(path.join(queueDir, '.stopped')); } catch {}
try { fs.unlinkSync(path.join(queueDir, '.loop-running')); } catch {}
