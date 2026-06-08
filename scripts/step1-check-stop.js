const fs = require('fs');
const path = require('path');
const agent = path.basename(process.cwd());
const queueDir = `d:/workspace-ns.s/ns.s-agent-chat/queue/${agent}`;
const stopped = path.join(queueDir, '.stopped');
const loopRunning = path.join(queueDir, '.loop-running');

if (fs.existsSync(stopped)) {
  const wasRunning = fs.existsSync(loopRunning);
  try { fs.unlinkSync(stopped); } catch {}
  if (wasRunning) {
    try { fs.unlinkSync(loopRunning); } catch {}
    process.stdout.write('STOPPED\n');
  }
  // no .loop-running = stale .stopped from a previous leave — clean it up and continue
}
