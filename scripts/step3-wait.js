const fs = require('fs');
const path = require('path');
const agent = path.basename(process.cwd());
const queueDir = `d:/workspace-ns.s/ns.s-agent-chat/queue/${agent}`;

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

while (true) {
  if (fs.existsSync(path.join(queueDir, '.stopped'))) {
    process.stdout.write('STOP\n');
    break;
  }
  const files = fs.readdirSync(queueDir).filter(f => f.endsWith('.json')).sort();
  if (files.length > 0) {
    const f = path.join(queueDir, files[0]);
    const content = fs.readFileSync(f, 'utf8');
    fs.unlinkSync(f);
    process.stdout.write(content + '\n');
    break;
  }
  sleep(5000);
}
