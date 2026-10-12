import { useEffect, useState } from 'react'
import './App.css'

async function requestCounter(path, method = 'GET') {
  const response = await fetch(path, { method })

  if (!response.ok) {
    throw new Error(`The counter service returned ${response.status}.`)
  }

  const data = await response.json()

  if (typeof data.value !== 'number') {
    throw new Error('The counter service returned an unexpected response.')
  }

  return data.value
}

function App() {
  const [count, setCount] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    requestCounter('/api/counter')
      .then((value) => {
        if (!cancelled) setCount(value)
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function updateCounter(action) {
    setBusy(true)
    setError('')

    try {
      setCount(await requestCounter(`/api/counter/${action}`, 'POST'))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Counter Studio home">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>counter<span className="brand-light">studio</span></span>
        </a>
        <span className="service-status">
          <span
            className={`status-dot ${error ? 'status-dot-error' : count === null ? 'status-dot-pending' : ''}`}
            aria-hidden="true"
          />
          {error ? '.NET unavailable' : count === null ? 'Connecting' : '.NET connected'}
        </span>
      </header>

      <section className="counter-card" aria-labelledby="page-title">
        <div className="card-heading">
          <span className="eyebrow">A LITTLE MOMENTUM</span>
          <span className="counter-icon" aria-hidden="true">↗</span>
        </div>
        <h1 id="page-title">One step at a time.</h1>
        <p className="intro">A simple counter, ready for whatever you’re counting.</p>

        <div className="count-panel" aria-live="polite" aria-atomic="true">
          <span className="count-label">CURRENT COUNT</span>
          <span className="count-value">{count === null ? '—' : count}</span>
          <span className="count-caption">
            {count === 1 ? 'step taken' : 'steps taken'}
          </span>
        </div>

        <div className="controls" aria-label="Counter controls">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => updateCounter('decrement')}
            disabled={busy || count === null}
            aria-label="Decrease count"
          >
            <span aria-hidden="true">−</span>
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => updateCounter('increment')}
            disabled={busy || count === null}
          >
            <span aria-hidden="true">+</span>
            Add a step
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => updateCounter('reset')}
            disabled={busy || count === null || count === 0}
          >
            Reset
          </button>
        </div>

        {error && (
          <p className="error-message" role="alert">
            {error} Make sure the .NET app is running, then refresh the page.
          </p>
        )}

        <p className="card-note">Small progress is still progress.</p>
      </section>

      <footer className="page-footer">
        <span>Made for the next little win.</span>
        <span>React <span className="footer-plus">+</span> .NET</span>
      </footer>
    </main>
  )
}

export default App
