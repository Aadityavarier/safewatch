const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  for (const file of fs.readdirSync(dir)) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) results = results.concat(walk(p));
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      lines.forEach((l, i) => {
        if (l.includes('<select')) {
          // get surrounding lines
          const context = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 6)).join('\n');
          results.push({ file: p, line: i + 1, content: l.trim(), context });
        }
      });
    }
  }
  return results;
}
console.log(JSON.stringify(walk('src'), null, 2));
