#!/usr/bin/env python
"""Sobe a versao do app em index.html e sw.js de uma vez so.

Uso:  python bump-version.py          -> incrementa
      python bump-version.py 12       -> define
"""
import io, re, sys

def ler(p):  return io.open(p, encoding='utf-8').read()
def escrever(p, s): io.open(p, 'w', encoding='utf-8', newline='\n').write(s)

sw = ler('sw.js')
atual = int(re.search(r"cifras-v(\d+)", sw).group(1))
nova = int(sys.argv[1]) if len(sys.argv) > 1 else atual + 1

sw = re.sub(r"cifras-v\d+", "cifras-v%d" % nova, sw)
sw = re.sub(r"(\./(?:css|js)/[\w.-]+)(\?v=\d+)?'", r"\1?v=%d'" % nova, sw)
escrever('sw.js', sw)

html = ler('index.html')
html = re.sub(r'((?:href|src)="(?:css|js)/[\w.-]+)(\?v=\d+)?"', r'\1?v=%d"' % nova, html)
escrever('index.html', html)

print("versao %d -> %d" % (atual, nova))
