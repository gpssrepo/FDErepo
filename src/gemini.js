// Gemini REST client with streaming (SSE).
export const DEFAULT_MODEL = 'gemini-3.8-flash'
export const MODEL_SUGGESTIONS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// Speed: turn off "thinking" and cap output. If the model rejects the thinking field, retry without it.
async function post(url, apiKey, body, signal) {
  const send = (cfg) => fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ ...body, generationConfig: { ...body.generationConfig, ...cfg } }),
  })
  let cfg = { thinkingConfig: { thinkingBudget: 0 } }
  let res
  // Retry overloaded / rate-limited responses (503, 429, 500) with a short backoff.
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await send(cfg)
    if (res.status === 400 && cfg.thinkingConfig) { cfg = {}; res = await send(cfg) }
    if (![429, 500, 503].includes(res.status) || attempt === 3) break
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  }
  return res
}

export async function streamChat({ apiKey, model = DEFAULT_MODEL, systemPrompt, messages, onToken, signal }) {
  const res = await post(`${BASE}/${model}:streamGenerateContent?alt=sse`, apiKey, {
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
    throw new Error(hint(res.status, msg))
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
export async function generateJSON({ apiKey, model = DEFAULT_MODEL, prompt, signal }) {
  const res = await post(`${BASE}/${model}:generateContent`, apiKey, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, responseMimeType: 'application/json' },
  }, signal)
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try { msg = (await res.json())?.error?.message || msg } catch { /* ignore */ }
    throw new Error(hint(res.status, msg))
  }
  const data = await res.json()
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
  return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim())
}

function hint(status, msg) {
  if (status === 503 || status === 429) return `${msg} (tried 4 times — pick another model in the sidebar, e.g. gemini-2.5-flash, or retry shortly.)`
  if (status === 404) return `${msg} (this model name may not exist — pick another one in the sidebar.)`
  return msg
}
