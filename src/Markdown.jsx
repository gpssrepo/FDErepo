import React from 'react'

// Tiny safe markdown renderer (no innerHTML): headings, lists, code, bold, italics, inline code.
function inline(text, keyPrefix) {
  const out = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g
  let last = 0
  let m
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    const k = `${keyPrefix}-${i++}`
    if (t.startsWith('`')) out.push(<code key={k}>{t.slice(1, -1)}</code>)
    else if (t.startsWith('**')) out.push(<strong key={k}>{t.slice(2, -2)}</strong>)
    else out.push(<em key={k}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export default function Markdown({ text }) {
  const lines = text.split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      const code = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++])
      i++
      blocks.push(<pre key={blocks.length}><code>{code.join('\n')}</code></pre>)
    } else if (/^\s*([-*•]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items = []
      while (i < lines.length && /^\s*([-*•]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+\.)\s+/, ''))
        i++
      }
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag key={blocks.length}>
          {items.map((it, j) => <li key={j}>{inline(it, `l${blocks.length}-${j}`)}</li>)}
        </Tag>,
      )
    } else if (/^#{1,4}\s/.test(line)) {
      blocks.push(<h4 key={blocks.length}>{inline(line.replace(/^#{1,4}\s/, ''), `h${blocks.length}`)}</h4>)
      i++
    } else if (!line.trim()) {
      i++
    } else {
      const para = []
      while (i < lines.length && lines[i].trim() && !/^(\s*([-*•]|\d+\.)\s+|#{1,4}\s|```)/.test(lines[i])) para.push(lines[i++])
      blocks.push(<p key={blocks.length}>{inline(para.join(' '), `p${blocks.length}`)}</p>)
    }
  }
  return <>{blocks}</>
}
