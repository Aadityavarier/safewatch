#!/bin/sh
set -e
npx tsc -b && npx vite build >/dev/null
python3 - <<'PY'
import re
s=open('dist/index.html').read()
head=re.search(r'<head>(.*?)</head>', s, re.S).group(1)
body=re.search(r'<body>(.*?)</body>', s, re.S).group(1)
head=re.sub(r'<meta[^>]*>\s*','',head)
title=re.search(r'<title>.*?</title>',head).group(0)
head=head.replace(title,'')
open('dist/safewatch.html','w').write(title+'\n'+head+'\n'+body)
PY
