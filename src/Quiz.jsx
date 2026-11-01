import React, { useState } from 'react'
import { generateJSON } from './gemini.js'

export const initialQuiz = { status: 'setup', questions: [], idx: 0, picked: null, score: 0, results: [], error: '' }
const LETTERS = ['A', 'B', 'C', 'D']

function buildPrompt(role, { topic, count, difficulty }) {
  return `Create a ${difficulty} difficulty multiple-choice quiz of exactly ${count} questions to help someone prepare for a ${role.label} interview.
${topic ? `Focus topic: ${topic}.` : 'Cover a broad mix of the most commonly tested areas for this role.'}
Each question must have exactly 4 plausible options with exactly one correct answer; vary the position of the correct answer.
Return ONLY JSON in this shape:
{"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"1-3 sentences on why the answer is right"}]}
"answer" is the zero-based index of the correct option.`
}

function validate(list) {
  const qs = (list?.questions || list || []).filter(
    (q) => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length >= 2 &&
      Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
  )
  if (!qs.length) throw new Error('The model returned an unusable quiz. Please try again.')
  return qs
}

export default function Quiz({ role, apiKey, quiz, setQuiz }) {
  const [cfg, setCfg] = useState({ topic: '', count: 5, difficulty: 'medium' })
  const patch = (p) => setQuiz((q) => ({ ...q, ...p }))

  const start = async () => {
    patch({ status: 'loading', error: '' })
    try {
      const json = await generateJSON({ apiKey, prompt: buildPrompt(role, cfg) })
      setQuiz({ ...initialQuiz, status: 'active', questions: validate(json) })
    } catch (e) {
      patch({ status: 'setup', error: e.message })
    }
  }

  const pick = (i) => {
    if (quiz.picked !== null) return
    const q = quiz.questions[quiz.idx]
    const ok = i === q.answer
    patch({ picked: i, score: quiz.score + (ok ? 1 : 0), results: [...quiz.results, { picked: i, ok }] })
  }

  const next = () => {
    if (quiz.idx + 1 >= quiz.questions.length) patch({ status: 'done' })
    else patch({ idx: quiz.idx + 1, picked: null })
  }

  if (quiz.status === 'setup' || quiz.status === 'loading') {
    const loading = quiz.status === 'loading'
    return (
      <div className="pane quiz">
        <div className="card">
          <h2>{role.label} quiz</h2>
          <p className="muted">Test yourself with AI-generated multiple-choice questions and get an explanation for every answer.</p>
          <label>Topic <span className="muted">(optional)</span>
            <input value={cfg.topic} onChange={(e) => setCfg({ ...cfg, topic: e.target.value })} placeholder="e.g. RAG, evals, system design" disabled={loading} />
          </label>
          <div className="row">
            <div>
              <span className="lbl">Questions</span>
              <div className="seg">{[5, 10].map((n) => (
                <button key={n} type="button" className={cfg.count === n ? 'on' : ''} onClick={() => setCfg({ ...cfg, count: n })} disabled={loading}>{n}</button>
              ))}</div>
            </div>
            <div>
              <span className="lbl">Difficulty</span>
              <div className="seg">{['easy', 'medium', 'hard'].map((d) => (
                <button key={d} type="button" className={cfg.difficulty === d ? 'on' : ''} onClick={() => setCfg({ ...cfg, difficulty: d })} disabled={loading}>{d}</button>
              ))}</div>
            </div>
          </div>
          {quiz.error && <div className="error">⚠️ {quiz.error}</div>}
          <button className="send big" onClick={start} disabled={loading}>{loading ? 'Generating quiz…' : 'Start quiz'}</button>
        </div>
      </div>
    )
  }

  if (quiz.status === 'done') {
    const total = quiz.questions.length
    const pct = Math.round((quiz.score / total) * 100)
    return (
      <div className="pane quiz">
        <div className="card">
          <h2>Quiz complete 🎉</h2>
          <div className="score"><strong>{quiz.score}</strong> / {total} <span className="muted">({pct}%)</span></div>
          <p className="muted">{pct >= 80 ? 'Excellent — you are interview-ready on this topic.' : pct >= 50 ? 'Solid start. Review the misses below and try again.' : 'Keep practicing — review the explanations below.'}</p>
          <div className="review">
            {quiz.questions.map((q, i) => (
              <details key={i} className={quiz.results[i]?.ok ? 'ok' : 'bad'}>
                <summary>{quiz.results[i]?.ok ? '✅' : '❌'} {q.question}</summary>
                <p><strong>Answer:</strong> {q.options[q.answer]}</p>
                {!quiz.results[i]?.ok && <p><strong>You chose:</strong> {q.options[quiz.results[i]?.picked]}</p>}
                <p className="muted">{q.explanation}</p>
              </details>
            ))}
          </div>
          <button className="send big" onClick={() => setQuiz(initialQuiz)}>New quiz</button>
        </div>
      </div>
    )
  }

  const q = quiz.questions[quiz.idx]
  const total = quiz.questions.length
  const answered = quiz.picked !== null
  return (
    <div className="pane quiz">
      <div className="card">
        <div className="qhead">
          <span>Question {quiz.idx + 1} of {total}</span>
          <span>Score: {quiz.score}</span>
        </div>
        <div className="bar"><div style={{ width: `${((quiz.idx + (answered ? 1 : 0)) / total) * 100}%` }} /></div>
        <h3>{q.question}</h3>
        <div className="opts">
          {q.options.map((o, i) => {
            const state = !answered ? '' : i === q.answer ? 'correct' : i === quiz.picked ? 'wrong' : 'dim'
            return (
              <button key={i} className={`opt ${state}`} onClick={() => pick(i)} disabled={answered}>
                <b>{LETTERS[i]}</b><span>{o}</span>
              </button>
            )
          })}
        </div>
        {answered && (
          <div className={`explain ${quiz.picked === q.answer ? 'ok' : 'bad'}`}>
            <strong>{quiz.picked === q.answer ? 'Correct!' : 'Not quite.'}</strong> {q.explanation}
          </div>
        )}
        <div className="qfoot">
          <button className="link" onClick={() => setQuiz(initialQuiz)}>Quit quiz</button>
          {answered && <button className="send" onClick={next}>{quiz.idx + 1 >= total ? 'See results' : 'Next →'}</button>}
        </div>
      </div>
    </div>
  )
}
