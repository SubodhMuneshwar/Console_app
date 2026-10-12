import { useEffect, useState, useCallback } from 'react'
import Confetti from './Confetti.jsx'
import { playOp, playUndo, playWin, playTap, isSoundEnabled, setSoundEnabled } from './sound.js'
import './App.css'

async function apiRequest(path, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(path, options)
  if (!response.ok) {
    throw new Error(`The service returned HTTP ${response.status}.`)
  }
  return await response.json()
}

const LEVELS = [
  { id: 1, name: 'Warmup', range: '15 – 40' },
  { id: 2, name: 'Casual', range: '41 – 90' },
  { id: 3, name: 'Challenger', range: '91 – 200' },
  { id: 4, name: 'Expert', range: '201 – 350' },
  { id: 5, name: 'Master', range: '351 – 500' },
]

export default function App() {
  const [mode, setMode] = useState('game') // 'game' | 'classic'
  const [gameState, setGameState] = useState(null)
  const [classicCount, setClassicCount] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [soundOn, setSoundOn] = useState(isSoundEnabled())
  const [celebrating, setCelebrating] = useState(false)

  // Load Game and Classic State on Mount
  const refreshAll = useCallback(async () => {
    try {
      setError('')
      const [gData, cData] = await Promise.all([
        apiRequest('/api/game'),
        apiRequest('/api/counter'),
      ])
      setGameState(gData)
      setClassicCount(cData.value)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    apiRequest('/api/game')
      .then((gData) => {
        if (!ignore) setGameState(gData)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    apiRequest('/api/counter')
      .then((cData) => {
        if (!ignore) setClassicCount(cData.value)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })

    return () => {
      ignore = true
    }
  }, [])


  // Sound toggle
  function handleToggleSound() {
    const next = !soundOn
    setSoundOn(next)
    setSoundEnabled(next)
    if (next) playTap(600, 0.05)
  }

  // Handle Game Operation
  const handleOp = useCallback(async (op) => {
    if (busy || !gameState || gameState.isWon) return

    // If division is attempted on odd number, disallow
    if (op === '/2' && Math.abs(gameState.currentValue % 2) !== 0) {
      playTap(200, 0.1)
      return
    }

    setBusy(true)
    setError('')
    try {
      playOp(op)
      const next = await apiRequest('/api/game/op', 'POST', { op })
      setGameState(next)

      if (next.isWon) {
        setCelebrating(true)
        playWin()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }, [busy, gameState])

  // Handle Undo
  const handleUndo = useCallback(async () => {
    if (busy || !gameState || gameState.history.length <= 1 || gameState.isWon) return
    setBusy(true)
    setError('')
    try {
      playUndo()
      const next = await apiRequest('/api/game/undo', 'POST')
      setGameState(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }, [busy, gameState])

  // Handle Reset Round
  const handleResetRound = useCallback(async () => {
    if (busy || !gameState) return
    setBusy(true)
    setError('')
    setCelebrating(false)
    try {
      playTap(350, 0.08)
      const next = await apiRequest('/api/game/reset', 'POST')
      setGameState(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }, [busy, gameState])

  // Handle New Game / Next Level
  const handleNewGame = useCallback(async (targetLevel = null) => {
    if (busy) return
    setBusy(true)
    setError('')
    setCelebrating(false)
    try {
      playTap(520, 0.09)
      const lvl = targetLevel ?? (gameState?.level || 1)
      const next = await apiRequest('/api/game/new', 'POST', { level: lvl })
      setGameState(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }, [busy, gameState])

  // Classic Counter update
  async function handleClassicUpdate(action) {
    setBusy(true)
    setError('')
    try {
      playTap(action === 'increment' ? 520 : action === 'decrement' ? 420 : 320)
      const res = await apiRequest(`/api/counter/${action}`, 'POST')
      setClassicCount(res.value)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Keyboard controls
  useEffect(() => {
    function handleKeyDown(e) {
      if (mode !== 'game' || !gameState || gameState.isWon) return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === '1') handleOp('+1')
      else if (e.key === '5') handleOp('+5')
      else if (e.key === '0') handleOp('+10')
      else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleUndo()
      } else if (e.key === 'r' || e.key === 'R') {
        handleResetRound()
      } else if (e.key === 'n' || e.key === 'N') {
        handleNewGame()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, gameState, handleOp, handleUndo, handleResetRound, handleNewGame])


  // Distance calculation
  const distance = gameState ? gameState.target - gameState.currentValue : 0
  const isOvershot = distance < 0
  const isEven = gameState ? gameState.currentValue % 2 === 0 : true

  // Star Rating
  const starsEarned = gameState && gameState.isWon
    ? gameState.moves <= gameState.parMoves
      ? 3
      : gameState.moves <= gameState.parMoves + 2
      ? 2
      : 1
    : 0

  return (
    <main className="page">
      <Confetti active={celebrating} />

      {/* Header & Global Nav */}
      <header className="topbar">
        <div className="brand-group">
          <a className="brand" href="/" aria-label="Counter Studio home">
            <span className="brand-mark" aria-hidden="true">C</span>
            <span>counter<span className="brand-light">studio</span></span>
          </a>
          <div className="mode-pill" role="tablist" aria-label="Application mode">
            <button
              id="mode-tab-game"
              role="tab"
              aria-selected={mode === 'game'}
              className={`mode-btn ${mode === 'game' ? 'active' : ''}`}
              onClick={() => { setMode('game'); playTap(500, 0.04); }}
              type="button"
            >
              <span className="mode-icon">🎯</span> Target Match
            </button>
            <button
              id="mode-tab-classic"
              role="tab"
              aria-selected={mode === 'classic'}
              className={`mode-btn ${mode === 'classic' ? 'active' : ''}`}
              onClick={() => { setMode('classic'); playTap(500, 0.04); }}
              type="button"
            >
              Classic Studio
            </button>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            id="sound-toggle-btn"
            className="icon-action-btn"
            onClick={handleToggleSound}
            title={soundOn ? 'Mute sound effects' : 'Unmute sound effects'}
            type="button"
            aria-label="Toggle Sound"
          >
            {soundOn ? '🔊' : '🔇'}
          </button>

          <span className="service-status">
            <span
              className={`status-dot ${error ? 'status-dot-error' : !gameState ? 'status-dot-pending' : ''}`}
              aria-hidden="true"
            />
            {error ? '.NET unavailable' : !gameState ? 'Connecting' : '.NET connected'}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      {mode === 'game' ? (
        <section className="game-container" aria-label="Target Match Puzzle Game">
          {/* Level Bar & Player Stats */}
          <div className="level-bar">
            <div className="level-selector" role="radiogroup" aria-label="Game Difficulty Levels">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl.id}
                  id={`level-btn-${lvl.id}`}
                  role="radio"
                  aria-checked={gameState?.level === lvl.id}
                  className={`level-chip ${gameState?.level === lvl.id ? 'active' : ''}`}
                  onClick={() => handleNewGame(lvl.id)}
                  disabled={busy}
                  type="button"
                >
                  <span className="chip-lvl">L{lvl.id}</span>
                  <span className="chip-name">{lvl.name}</span>
                </button>
              ))}
            </div>

            <div className="stats-badges">
              <div className="stat-badge" title="Consecutive puzzle wins">
                <span className="badge-icon">🔥</span>
                <span className="badge-label">Streak:</span>
                <strong>{gameState?.currentStreak ?? 0}</strong>
                {gameState && gameState.bestStreak > 0 && (
                  <span className="badge-sub">(Best {gameState.bestStreak})</span>
                )}
              </div>
              <div className="stat-badge" title="Total targets solved">
                <span className="badge-icon">🏆</span>
                <span className="badge-label">Solved:</span>
                <strong>{gameState?.gamesWon ?? 0}</strong>
              </div>
            </div>
          </div>

          {/* Core Game Card */}
          <div className={`puzzle-card ${gameState?.isWon ? 'card-won' : ''}`}>
            {/* Target Display Header */}
            <div className="target-banner">
              <div className="target-block">
                <span className="banner-eyebrow">TARGET NUMBER</span>
                <div className="target-number-row">
                  <span className="target-digit">{gameState ? gameState.target : '—'}</span>
                  <span
                    className={`distance-tag ${
                      gameState?.isWon
                        ? 'tag-hit'
                        : isOvershot
                        ? 'tag-overshot'
                        : 'tag-pending'
                    }`}
                  >
                    {gameState?.isWon
                      ? '🎯 MATCH REACHED!'
                      : isOvershot
                      ? `⚠️ Overshot by ${Math.abs(distance)}`
                      : `🏁 ${distance} away`}
                  </span>
                </div>
              </div>

              <div className="par-block">
                <span className="banner-eyebrow">PAR EFFICIENCY</span>
                <div className="par-metrics">
                  <span className="moves-count">
                    <strong>{gameState ? gameState.moves : 0}</strong>
                    <span className="moves-label"> / {gameState?.parMoves ?? '—'} par moves</span>
                  </span>
                  <div className="par-stars" aria-label="Efficiency rating">
                    {gameState && (
                      <>
                        <span className={`star ${gameState.moves <= gameState.parMoves ? 'active' : 'faded'}`}>★</span>
                        <span className={`star ${gameState.moves <= gameState.parMoves + 2 ? 'active' : 'faded'}`}>★</span>
                        <span className={`star ${gameState.moves <= gameState.parMoves + 5 ? 'active' : 'faded'}`}>★</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Current Value Visualizer */}
            <div className="current-display">
              <span className="display-label">CURRENT VALUE</span>
              <div className="number-hero">
                <span className="number-large">{gameState ? gameState.currentValue : '—'}</span>
              </div>

              {/* Progress gauge towards target */}
              {gameState && gameState.target > 0 && (
                <div className="progress-track" aria-hidden="true">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, (gameState.currentValue / gameState.target) * 100))}%`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Breadcrumb Formula History */}
            <div className="history-tray">
              <span className="history-label">JOURNEY:</span>
              <div className="history-pills">
                {gameState && gameState.history && gameState.history.length > 0 ? (
                  gameState.history.map((step, idx) => (
                    <span key={idx} className={`history-step ${idx === gameState.history.length - 1 ? 'latest' : ''}`}>
                      {step}
                    </span>
                  ))
                ) : (
                  <span className="history-empty">Make your first move below</span>
                )}
              </div>
            </div>

            {/* Victory Celebration Card Banner */}
            {gameState?.isWon && (
              <div className="win-banner" role="status">
                <div className="win-stars">
                  {'⭐'.repeat(starsEarned || 1)}
                </div>
                <h2 className="win-title">
                  {starsEarned === 3 ? 'Mastermind! Flawless Par!' : starsEarned === 2 ? 'Brilliant Solution!' : 'Target Conquered!'}
                </h2>
                <p className="win-desc">
                  Matched target <strong>{gameState.target}</strong> in <strong>{gameState.moves}</strong> moves
                  (Par was {gameState.parMoves}).
                </p>
                <div className="win-actions">
                  <button
                    id="win-next-btn"
                    className="btn btn-emerald"
                    onClick={() => handleNewGame(Math.min(5, (gameState.level || 1) + 1))}
                    type="button"
                  >
                    Next Challenge ➔
                  </button>
                  <button
                    id="win-replay-btn"
                    className="btn btn-ghost"
                    onClick={handleResetRound}
                    type="button"
                  >
                    Replay for Better Par
                  </button>
                </div>
              </div>
            )}

            {/* Operations Keypad */}
            {!gameState?.isWon && (
              <div className="controls-section">
                <div className="op-group">
                  <span className="op-group-title">ADD</span>
                  <div className="op-row">
                    <button
                      id="op-add-1"
                      className="btn-op btn-op-add"
                      onClick={() => handleOp('+1')}
                      disabled={busy}
                      type="button"
                    >
                      +1
                    </button>
                    <button
                      id="op-add-5"
                      className="btn-op btn-op-add"
                      onClick={() => handleOp('+5')}
                      disabled={busy}
                      type="button"
                    >
                      +5
                    </button>
                    <button
                      id="op-add-10"
                      className="btn-op btn-op-add"
                      onClick={() => handleOp('+10')}
                      disabled={busy}
                      type="button"
                    >
                      +10
                    </button>
                  </div>
                </div>

                <div className="op-group">
                  <span className="op-group-title">SUBTRACT</span>
                  <div className="op-row">
                    <button
                      id="op-sub-1"
                      className="btn-op btn-op-sub"
                      onClick={() => handleOp('-1')}
                      disabled={busy}
                      type="button"
                    >
                      −1
                    </button>
                    <button
                      id="op-sub-5"
                      className="btn-op btn-op-sub"
                      onClick={() => handleOp('-5')}
                      disabled={busy}
                      type="button"
                    >
                      −5
                    </button>
                  </div>
                </div>

                <div className="op-group">
                  <span className="op-group-title">MULTIPLY & DIVIDE</span>
                  <div className="op-row">
                    <button
                      id="op-mul-2"
                      className="btn-op btn-op-mul"
                      onClick={() => handleOp('*2')}
                      disabled={busy}
                      type="button"
                    >
                      ×2
                    </button>
                    <button
                      id="op-mul-3"
                      className="btn-op btn-op-mul"
                      onClick={() => handleOp('*3')}
                      disabled={busy}
                      type="button"
                    >
                      ×3
                    </button>
                    <button
                      id="op-div-2"
                      className={`btn-op btn-op-div ${!isEven ? 'op-disabled-notice' : ''}`}
                      onClick={() => handleOp('/2')}
                      disabled={busy || !isEven}
                      title={!isEven ? 'Division only allowed on even numbers' : 'Divide by 2'}
                      type="button"
                    >
                      ÷2
                    </button>
                  </div>
                </div>

                {/* Round Control Tools */}
                <div className="utility-bar">
                  <button
                    id="btn-undo"
                    className="btn-util"
                    onClick={handleUndo}
                    disabled={busy || !gameState || gameState.history.length <= 1}
                    title="Undo last step (Ctrl+Z)"
                    type="button"
                  >
                    <span>↶ Undo</span>
                  </button>
                  <button
                    id="btn-restart"
                    className="btn-util"
                    onClick={handleResetRound}
                    disabled={busy || !gameState || gameState.moves === 0}
                    title="Reset round to 0 (R)"
                    type="button"
                  >
                    <span>↺ Reset</span>
                  </button>
                  <button
                    id="btn-new-target"
                    className="btn-util btn-util-accent"
                    onClick={() => handleNewGame()}
                    disabled={busy}
                    title="Generate new target (N)"
                    type="button"
                  >
                    <span>🎲 New Target</span>
                  </button>
                </div>
              </div>
            )}

            {/* Keyboard shortcut hint */}
            <div className="keyboard-hints">
              <span>Shortcuts: <strong>1</strong> for +1 &bull; <strong>5</strong> for +5 &bull; <strong>0</strong> for +10 &bull; <strong>Ctrl+Z</strong> Undo &bull; <strong>R</strong> Reset &bull; <strong>N</strong> New</span>
            </div>
          </div>
        </section>
      ) : (
        /* Classic Counter Mode */
        <section className="classic-container" aria-label="Classic Counter">
          <div className="classic-card">
            <div className="card-heading">
              <span className="eyebrow">CLASSIC MODE</span>
              <span className="counter-icon" aria-hidden="true">↗</span>
            </div>
            <h1 id="page-title">One step at a time.</h1>
            <p className="intro">The original minimal counter, ready for whatever you're counting.</p>

            <div className="count-panel" aria-live="polite" aria-atomic="true">
              <span className="count-label">CURRENT COUNT</span>
              <span className="count-value">{classicCount === null ? '—' : classicCount}</span>
              <span className="count-caption">
                {classicCount === 1 ? 'step taken' : 'steps taken'}
              </span>
            </div>

            <div className="controls">
              <button
                id="classic-decrement"
                className="button button-secondary"
                type="button"
                onClick={() => handleClassicUpdate('decrement')}
                disabled={busy || classicCount === null}
                aria-label="Decrease count"
              >
                <span aria-hidden="true">−</span>
              </button>
              <button
                id="classic-increment"
                className="button button-primary"
                type="button"
                onClick={() => handleClassicUpdate('increment')}
                disabled={busy || classicCount === null}
              >
                <span aria-hidden="true">+</span>
                Add a step
              </button>
              <button
                id="classic-reset"
                className="button button-secondary"
                type="button"
                onClick={() => handleClassicUpdate('reset')}
                disabled={busy || classicCount === null || classicCount === 0}
              >
                Reset
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Error Message Alert */}
      {error && (
        <div className="error-banner" role="alert">
          <span>⚠️ {error} Make sure the .NET server is running on port 5057.</span>
          <button className="error-retry" onClick={refreshAll} type="button">
            Reconnect
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="page-footer">
        <span>Target Match &bull; Counter Studio</span>
        <span>Built with .NET 10 + React 19</span>
      </footer>
    </main>
  )
}
