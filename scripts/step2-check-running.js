const fs = require('fs');
const path = require('path');
const agent = path.basename(process.cwd());
const queueDir = `d:/workspace-ns.s/ns.s-agent-chat/queue/${agent}`;
if (fs.existsSync(path.join(queueDir, '.loop-running'))) {
  process.stdout.write('ALREADY_RUNNING\n');
}
