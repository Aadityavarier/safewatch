import fs from 'fs'
import path from 'path'

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) {
      const c = fs.readFileSync(p, 'utf8')
      const lines = c.split('\n')
      lines.forEach((line, idx) => {
        if (line.includes('risk_level') || line.includes('strength') || line.includes('Strength') || line.includes('AreaLevel')) {
          console.log(`${p}:${idx + 1}: ${line.trim()}`)
        }
      })
    }
  }
}

walk('src')
