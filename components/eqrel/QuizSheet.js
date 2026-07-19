'use client'

/**
 * QuizSheet — full-screen quiz overlay for kids.
 * 5 visual questions, 4 choices each, immediate feedback.
 * Correct answers earn Mata Bina (Character Points) only — NOT Mata Reward.
 * One session per day per child (server-enforced).
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, XIcon, Sparkles, ArrowRight } from 'lucide-react'
import { pickText } from '@/lib/quizBank'
import { useLang } from '@/lib/i18n/LangProvider'

export function QuizSheet({ open, onClose, childId, onComplete }) {
  const { t, lang } = useLang()
  const [phase, setPhase] = useState('loading')  // 'loading' | 'question' | 'feedback' | 'done' | 'blocked' | 'error'
  const [sessionId, setSessionId] = useState(null)
  const [questions, setQuestions] = useState([])
  const [current, setCurrent] = useState(0)
  const [chosen, setChosen] = useState(null)
  const [lastCorrect, setLastCorrect] = useState(null)
  const [lastCorrectIdx, setLastCorrectIdx] = useState(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [pointsAwarded, setPointsAwarded] = useState(0)
  const [errMsg, setErrMsg] = useState('')

  const reset = () => {
    setPhase('loading'); setSessionId(null); setQuestions([])
    setCurrent(0); setChosen(null); setLastCorrect(null); setLastCorrectIdx(null)
    setCorrectCount(0); setPointsAwarded(0); setErrMsg('')
  }

  const start = useCallback(async () => {
    reset()
    try {
      const r = await fetch('/api/quiz/start', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId }),
      })
      const d = await r.json()
      if (r.status === 429) { setPhase('blocked'); setErrMsg(d.error || t.quiz_already_done); return }
      if (!r.ok) { setPhase('error'); setErrMsg(d.error || 'Failed'); return }
      setSessionId(d.sessionId)
      setQuestions(d.questions || [])
      setCurrent(d.resumeAt || 0)
      setPhase('question')
    } catch (e) {
      setPhase('error'); setErrMsg('Network error')
    }
  }, [childId, t.quiz_already_done])

  useEffect(() => { if (open && childId) start() }, [open, childId, start])

  const submitAnswer = async (idx) => {
    if (chosen !== null || phase !== 'question') return
    setChosen(idx)
    const q = questions[current]
    try {
      const r = await fetch('/api/quiz/answer', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, questionId: q.id, choiceIdx: idx }),
      })
      const d = await r.json()
      if (!r.ok) { setPhase('error'); setErrMsg(d.error || 'Failed'); return }
      setLastCorrect(!!d.correct)
      setLastCorrectIdx(d.correctIdx)
      setCorrectCount(d.correctCount || 0)
      setPhase('feedback')
    } catch (e) {
      setPhase('error'); setErrMsg('Network error')
    }
  }

  const nextOrFinish = async () => {
    setChosen(null); setLastCorrect(null); setLastCorrectIdx(null)
    if (current + 1 < questions.length) {
      setCurrent(current + 1)
      setPhase('question')
    } else {
      // Finish
      try {
        const r = await fetch('/api/quiz/finish', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        const d = await r.json()
        if (r.ok) {
          setPointsAwarded(d.pointsAwarded || 0)
          setPhase('done')
          onComplete?.()
        } else {
          setPhase('error'); setErrMsg(d.error || 'Failed')
        }
      } catch (e) {
        setPhase('error'); setErrMsg('Network error')
      }
    }
  }

  const q = questions[current]
  const progress = questions.length > 0 ? Math.round(((current + (phase === 'feedback' ? 1 : 0)) / questions.length) * 100) : 0

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-gradient-to-br from-sky-100 via-blue-50 to-purple-50 flex flex-col overflow-y-auto"
        >
          {/* Header: progress bar + close */}
          <div className="flex-shrink-0 px-4 pt-3 pb-2 flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center flex-shrink-0"
              aria-label={t.cancel}
            >
              <X className="w-5 h-5 text-eq-ink/60" />
            </button>
            <div className="flex-1 h-2 rounded-full bg-white/80 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full"
                initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <div className="text-xs font-extrabold text-blue-900 flex-shrink-0">
              {phase === 'question' || phase === 'feedback' ? `${current + 1}/${questions.length}` : ''}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center px-5 py-4">
            {phase === 'loading' && (
              <div className="text-center text-blue-900/60">
                <div className="text-4xl mb-2 animate-pulse">🎓</div>
                <div className="text-sm">{t.loading}</div>
              </div>
            )}

            {phase === 'blocked' && (
              <div className="text-center max-w-xs">
                <div className="text-6xl mb-3">🌟</div>
                <h2 className="text-xl font-extrabold text-emerald-900 mb-2">{t.quiz_done_today_title}</h2>
                <p className="text-sm text-emerald-800/70 leading-snug">{errMsg || t.quiz_already_done}</p>
                <button
                  onClick={onClose}
                  className="mt-4 rounded-2xl bg-emerald-500 text-white font-extrabold px-6 py-2.5 text-sm active:scale-[0.99]"
                >{t.done}</button>
              </div>
            )}

            {phase === 'error' && (
              <div className="text-center max-w-xs">
                <div className="text-5xl mb-3">😢</div>
                <p className="text-sm text-red-700">{errMsg || 'Error'}</p>
                <button onClick={onClose} className="mt-4 rounded-2xl border-2 border-eq-cream px-6 py-2 text-sm font-bold">{t.cancel}</button>
              </div>
            )}

            {phase === 'done' && (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="text-center max-w-xs"
              >
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }}
                  transition={{ duration: 0.6 }}
                  className="text-7xl mb-3"
                >
                  {correctCount >= questions.length * 0.8 ? '🎉' : correctCount >= questions.length * 0.5 ? '🌟' : '💛'}
                </motion.div>
                <h2 className="text-2xl font-extrabold text-blue-900 mb-1">
                  {correctCount === questions.length ? t.quiz_perfect : t.quiz_great}
                </h2>
                <p className="text-sm text-blue-800/70 mb-4">
                  {t.quiz_score(correctCount, questions.length)}
                </p>
                <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-100 border-2 border-amber-300 px-4 py-2">
                  <Sparkles className="w-4 h-4 text-amber-600" fill="#FFB703" />
                  <span className="font-extrabold text-amber-900 text-sm">
                    +{pointsAwarded} {t.kid_mata_label}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-blue-800/60">{t.quiz_only_bina_note}</div>
                <button
                  onClick={onClose}
                  className="mt-5 rounded-2xl bg-blue-500 text-white font-extrabold px-6 py-2.5 text-sm active:scale-[0.99]"
                >{t.done}</button>
              </motion.div>
            )}

            {(phase === 'question' || phase === 'feedback') && q && (
              <motion.div
                key={current}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
              >
                {/* Question card */}
                <div className="rounded-3xl bg-white/85 backdrop-blur border-2 border-white shadow-md p-5 mb-4 text-center">
                  <div className="text-5xl mb-3">{q.emoji}</div>
                  <h2 className="text-lg font-extrabold text-blue-900 leading-tight">
                    {pickText(q.prompt, lang)}
                  </h2>
                </div>

                {/* Choices */}
                <div className="space-y-2">
                  {q.choices.map((c, idx) => {
                    const isChosen = chosen === idx
                    const isCorrect = lastCorrectIdx === idx
                    const showAsRight = phase === 'feedback' && isCorrect
                    const showAsWrong = phase === 'feedback' && isChosen && !lastCorrect
                    return (
                      <button
                        key={idx}
                        onClick={() => submitAnswer(idx)}
                        disabled={phase === 'feedback' || chosen !== null}
                        className={`w-full rounded-2xl border-2 px-4 py-3 flex items-center justify-between text-left font-extrabold text-sm transition-all active:scale-[0.99] ${
                          showAsRight ? 'bg-emerald-100 border-emerald-400 text-emerald-900 shadow-md' :
                          showAsWrong ? 'bg-red-100 border-red-400 text-red-900' :
                          isChosen ? 'bg-blue-100 border-blue-400 text-blue-900' :
                          phase === 'feedback' ? 'bg-white/70 border-eq-cream text-eq-ink/60' :
                          'bg-white border-eq-cream text-eq-ink hover:border-blue-300'
                        }`}
                      >
                        <span className="flex-1">{pickText(c, lang)}</span>
                        {showAsRight && <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" strokeWidth={3} />}
                        {showAsWrong && <XIcon className="w-5 h-5 text-red-500 flex-shrink-0" strokeWidth={3} />}
                      </button>
                    )
                  })}
                </div>

                {/* Feedback + Next button */}
                {phase === 'feedback' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4"
                  >
                    <div className={`rounded-2xl px-4 py-2 mb-3 text-center text-sm font-extrabold ${
                      lastCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-50 text-amber-800'
                    }`}>
                      {lastCorrect ? `✨ ${t.quiz_correct}` : `💛 ${t.quiz_wrong_gentle}`}
                    </div>
                    <button
                      onClick={nextOrFinish}
                      className="w-full rounded-2xl bg-blue-500 text-white font-extrabold py-3 text-sm active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      {current + 1 < questions.length ? t.quiz_next_question : t.quiz_finish}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default QuizSheet
