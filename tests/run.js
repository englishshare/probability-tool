// Runs every tests/*.test.js in one process:  node tests/run.js
// (`node --test <directory>` behaves differently across Node versions, so
// this just requires each file and lets node:test do the reporting.)
const fs = require('fs');
const path = require('path');

for (const f of fs.readdirSync(__dirname).filter(n => n.endsWith('.test.js')).sort()) {
  require(path.join(__dirname, f));
}
