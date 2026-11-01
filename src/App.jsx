import React, { useEffect, useRef, useState } from 'react'
import { ROLES } from './roles.js'
import { DEFAULT_MODEL, MODEL_SUGGESTIONS, streamChat, withFallback } from './gemini.js'
import Markdown from './Markdown.jsx'
import Quiz, { initialQuiz } from './Quiz.jsx'

const MODEL_STORAGE = 'gemini_model'
const loadModel = () => { try { return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL } catch { return DEFAULT_MODEL } }
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
  const [quizzes, setQuizzes] = useState(() => Object.fromEntries(ROLES.map((r) => [r.id, initialQuiz])))
  const [model, setModelState] = useState(loadModel)
  const setModel = (m) => { setModelState(m); try { localStorage.setItem(MODEL_STORAGE, m) } catch { /* ignore */ } }
  const [tab, setTab] = useState('chat')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [timing, setTiming] = useState(null) // {first, total} seconds for the last reply
  const [waited, setWaited] = useState(0)
  const [status, setStatus] = useState('')
  const [notice, setNotice] = useState('')
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

  useEffect(() => {
    if (!busy) { setWaited(0); return }
    const t = setInterval(() => setWaited((w) => w + 1), 1000)
    return () => clearInterval(t)
  }, [busy])

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
    setTiming(null)
    setStatus('')
    setNotice('')
    const t0 = Date.now()
    let first = null
    const secs = () => +((Date.now() - t0) / 1000).toFixed(1)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await withFallback(model.trim() || DEFAULT_MODEL, (m) => streamChat({
        apiKey,
        model: m,
        systemPrompt: role.prompt,
        messages: history,
        signal: ctrl.signal,
        onStatus: setStatus,
        onToken: (t) => { if (first === null) first = secs(); append(id, (msgs) => {
          const copy = msgs.slice()
          copy[copy.length - 1] = { ...copy[copy.length - 1], text: copy[copy.length - 1].text + t }
          return copy
        }) },
      }), setNotice)
      setTiming({ first, total: secs() })
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
  const clearChat = () => { abortRef.current?.abort(); setBusy(false); setError(''); append(roleId, () => []) }
  const setQuiz = (fn) => setQuizzes((q) => ({ ...q, [roleId]: typeof fn === 'function' ? fn(q[roleId]) : fn }))

  if (!apiKey) {
    return (
      <div className="gatewrap">
        <h1>AI Interview Agent</h1>
        <ApiKeyGate onSave={(k) => { saveKey(k); setApiKey(k) }} />
      </div>
    )
  }

  return (
    <div className="app">
      <aside className="side">
        <h1>AI Interview Agent</h1>
        <nav className="roles" aria-label="Choose the role you are interviewing for">
          <span className="sidelabel">Interviewing for</span>
          {ROLES.map((r) => (
            <button
              key={r.id}
              className={`role ${r.id === roleId ? 'active' : ''}`}
              style={{ '--c': r.accent }}
              onClick={() => switchRole(r.id)}
            >
              <i className="dot" />{r.label}
            </button>
          ))}
        </nav>
        <label className="modelpick">
          <span className="sidelabel">Model</span>
          <input list="models" value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} />
          <datalist id="models">{MODEL_SUGGESTIONS.map((m) => <option key={m} value={m} />)}</datalist>
        </label>
        <button className="link keybtn" onClick={resetKey} title="Change API key">🔑 Change key</button>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>💬 Chat</button>
            <button role="tab" aria-selected={tab === 'quiz'} className={tab === 'quiz' ? 'on' : ''} onClick={() => setTab('quiz')}>🧠 Quiz</button>
          </div>
          <span className="rolename">{role.label}</span>
          {tab === 'chat' && messages.length > 0 && <button className="link" onClick={clearChat}>Clear chat</button>}
        </div>

        {tab === 'quiz' ? (
          <Quiz key={roleId} role={role} apiKey={apiKey} model={model.trim() || DEFAULT_MODEL} quiz={quizzes[roleId]} setQuiz={setQuiz} />
        ) : (
          <>
            <div className="pane messages">
              <div className="thread">
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
                    {m.role === 'user' ? m.text : m.text ? <Markdown text={m.text} /> : <span className="typing"><i /><i /><i />{waited >= 3 && <em className="muted"> {status || `waiting ${waited}s…`}</em>}</span>}
                  </div>
                ))}
                {notice && <div className="notice">ℹ️ {notice}</div>}
                {error && <div className="error">⚠️ {error}</div>}
                <div ref={endRef} />
              </div>
            </div>
            <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input) }}>
              <textarea
                rows={1}
                value={input}
                placeholder={`Ask about ${role.short} interviews…  (Enter to send, Shift+Enter for new line)`}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
              />
              <button className="send" type="submit" disabled={busy || !input.trim()}>Send</button>
            </form>
          </>
        )}
        <div className="foot">Model: {model}{timing && ` · first words ${timing.first}s · total ${timing.total}s`}</div>
      </main>
    </div>
  )
}
