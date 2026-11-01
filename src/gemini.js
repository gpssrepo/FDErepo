// Gemini REST client with streaming (SSE).
export const MODEL = 'gemini-3.8-flash'
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export async function streamChat({ apiKey, systemPrompt, messages, onToken, signal }) {
  const res = await fetch(`${BASE}/${MODEL}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      })),
      generationConfig: { temperature: 0.8 },
    }),
  })

  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const j = await res.json()
      if (j?.error?.message) msg = j.error.message
    } catch { /* ignore */ }
    throw new Error(msg)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data) continue
      try {
        const parts = JSON.parse(data)?.candidates?.[0]?.content?.parts || []
        const text = parts.map((p) => p.text || '').join('')
        if (text) onToken(text)
      } catch { /* partial JSON, skip */ }
    }
  }
}
