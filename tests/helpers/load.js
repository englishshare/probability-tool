// The modules in js/ are classic browser scripts that share one global
// scope (so the page works straight from file:// with no bundler). To test
// them in Node, evaluate them in that same order inside a single function
// scope and hand back every top-level function/const they declare.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const ORDER = ['parser', 'algebra', 'solver', 'linear', 'venn', 'engine', 'ocr'];

function loadModules(files) {
  files = files || ORDER;
  const code = files
    .filter(f => fs.existsSync(path.join(ROOT, 'js', f + '.js')))
    .map(f => fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf-8'))
    .join('\n;\n');
  const names = new Set();
  for (const m of code.matchAll(/^(?:function\s+(\w+)|(?:const|let)\s+(\w+))/gm)) names.add(m[1] || m[2]);
  // eslint-disable-next-line no-new-func
  const factory = new Function('document', code + '\nreturn {' + [...names].join(',') + '};');
  return factory(undefined);
}

module.exports = { loadModules, ROOT, ORDER };
