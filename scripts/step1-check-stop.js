const fs = require('fs');
const path = require('path');
const agent = path.basename(process.cwd());
const queueDir = `d:/workspace-ns.s/ns.s-agent-chat/queue/${agent}`;
const stopped = path.join(queueDir, '.stopped');
if (fs.existsSync(stopped)) {
  try { fs.unlinkSync(stopped); } catch {}
  try { fs.unlinkSync(path.join(queueDir, '.loop-running')); } catch {}
  process.stdout.write('STOPPED\n');
}
