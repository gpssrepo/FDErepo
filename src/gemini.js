// Gemini REST client with streaming (SSE).
export const MODEL = 'gemini-3.8-flash'
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// Speed: turn off "thinking" and cap output. If the model rejects the thinking field, retry without it.
async function post(url, apiKey, body, signal) {
  const send = (cfg) => fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ ...body, generationConfig: { ...body.generationConfig, ...cfg } }),
  })
  let res = await send({ thinkingConfig: { thinkingBudget: 0 } })
  if (res.status === 400) {
    const retry = await send({})
    if (retry.ok) res = retry
  }
  return res
}

export async function streamChat({ apiKey, systemPrompt, messages, onToken, signal }) {
  const res = await post(`${BASE}/${MODEL}:streamGenerateContent?alt=sse`, apiKey, {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    // only send the most recent turns to keep requests small and fast
    contents: messages.slice(-12).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    })),
    generationConfig: { temperature: 0.8, maxOutputTokens: 1200 },
  }, signal)

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

// Non-streaming call that returns parsed JSON (used by the quiz generator).
export async function generateJSON({ apiKey, prompt, signal }) {
  const res = await post(`${BASE}/${MODEL}:generateContent`, apiKey, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, responseMimeType: 'application/json' },
  }, signal)
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try { msg = (await res.json())?.error?.message || msg } catch { /* ignore */ }
    throw new Error(msg)
  }
  const data = await res.json()
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
  return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim())
}
