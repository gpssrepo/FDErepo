import React, { useEffect, useRef, useState } from 'react'
import { ROLES } from './roles.js'
import { MODEL, streamChat } from './gemini.js'
import Markdown from './Markdown.jsx'

const KEY_STORAGE = 'gemini_api_key'
const loadKey = () => { try { return sessionStorage.getItem(KEY_STORAGE) || '' } catch { return '' } }
const saveKey = (k) => { try { k ? sessionStorage.setItem(KEY_STORAGE, k) : sessionStorage.removeItem(KEY_STORAGE) } catch { /* ignore */ } }

function ApiKeyGate({ onSave }) {
  const [value, setValue] = useState('')
  return (
    <form className="gate glass" onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSave(value.trim()) }}>
      <h2>Welcome 👋</h2>
      <p>Enter your Gemini API key to start practicing. It stays in this browser tab only (session storage) and is sent directly to Google.</p>
      <input
        type="password"
        autoFocus
        placeholder="Gemini API key"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
      />
      <button className="send" type="submit" disabled={!value.trim()}>Continue</button>
      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Get a free key from Google AI Studio →</a>
    </form>
  )
}

export default function App() {
  const [apiKey, setApiKey] = useState(loadKey)
  const [roleId, setRoleId] = useState(ROLES[0].id)
  // conversation kept separately per role
  const [chats, setChats] = useState(() => Object.fromEntries(ROLES.map((r) => [r.id, []])))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef(null)
  const endRef = useRef(null)

  const role = ROLES.find((r) => r.id === roleId)
  const messages = chats[roleId]

  useEffect(() => {
    const s = document.documentElement.style
    s.setProperty('--accent', role.accent)
    s.setProperty('--accent2', role.accent2)
    s.setProperty('--hue', role.hue)
  }, [role])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  const switchRole = (id) => {
    if (id === roleId) return
    abortRef.current?.abort()
    setBusy(false)
    setError('')
    setRoleId(id)
  }

  const append = (id, fn) => setChats((c) => ({ ...c, [id]: fn(c[id]) }))

  const send = async (text) => {
    text = text.trim()
    if (!text || busy) return
    const id = roleId
    const history = [...chats[id], { role: 'user', text }]
    append(id, () => [...history, { role: 'model', text: '' }])
    setInput('')
    setError('')
    setBusy(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await streamChat({
        apiKey,
        systemPrompt: role.prompt,
        messages: history,
        signal: ctrl.signal,
        onToken: (t) => append(id, (m) => {
          const copy = m.slice()
          copy[copy.length - 1] = { ...copy[copy.length - 1], text: copy[copy.length - 1].text + t }
          return copy
        }),
      })
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError(e.message)
        // drop empty placeholder
        append(id, (m) => (m[m.length - 1]?.text ? m : m.slice(0, -1)))
      }
    } finally {
      if (abortRef.current === ctrl) setBusy(false)
    }
  }

  const resetKey = () => { saveKey(''); setApiKey('') }

  return (
    <div className="app">
      <div className="frame glass">
        <header>
          <h1>AI Interview Agent</h1>
          {apiKey && <button className="link" onClick={resetKey} title="Change API key">🔑 Change key</button>}
        </header>

        {!apiKey ? (
          <ApiKeyGate onSave={(k) => { saveKey(k); setApiKey(k) }} />
        ) : (
          <>
            <nav className="roles" aria-label="Choose the role you are interviewing for">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  className={`role ${r.id === roleId ? 'active' : ''}`}
                  style={{ '--c': r.accent }}
                  onClick={() => switchRole(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </nav>

            <section className="chat">
              <div className="messages">
                {messages.length === 0 && (
                  <div className="welcome">
                    <p>Preparing for <strong>{role.label}</strong>? Pick a starter or ask anything.</p>
                    <div className="starters">
                      {role.starters.map((s) => (
                        <button key={s} onClick={() => send(s)}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'bot'}`}>
                    {m.role === 'user' ? m.text : m.text ? <Markdown text={m.text} /> : <span className="typing"><i /><i /><i /></span>}
                  </div>
                ))}
                {error && <div className="error">⚠️ {error}</div>}
                <div ref={endRef} />
              </div>

              <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input) }}>
                <textarea
                  rows={1}
                  value={input}
                  placeholder={`Ask about ${role.short} interviews…`}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                />
                <button className="send" type="submit" disabled={busy || !input.trim()}>Send</button>
              </form>
              <div className="foot">Model: {MODEL}</div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
