import fs from 'fs'

const s = fs.readFileSync('dist/index.html', 'utf8')
const headMatch = s.match(/<head>([\s\S]*?)<\/head>/)
const bodyMatch = s.match(/<body>([\s\S]*?)<\/body>/)

if (!headMatch || !bodyMatch) {
  console.error('Could not parse dist/index.html')
  process.exit(1)
}

let head = headMatch[1].replace(/<meta[^>]*>\s*/g, '')
const titleMatch = head.match(/<title>.*?<\/title>/)
const title = titleMatch ? titleMatch[0] : '<title>SAFEWATCH</title>'
head = head.replace(title, '')
const body = bodyMatch[1]

fs.writeFileSync('dist/safewatch.html', title + '\n' + head + '\n' + body)
console.log('dist/safewatch.html generated successfully!')
