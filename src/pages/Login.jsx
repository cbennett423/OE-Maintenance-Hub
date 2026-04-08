import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!email.endsWith('@oeconstruct.com')) {
      setError('Only @oeconstruct.com email addresses are allowed.')
      return
    }

    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="bg-black-card border border-border rounded-lg p-8 border-t-4 border-t-cat-yellow">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold uppercase tracking-wider text-cat-yellow">
              OE Maintenance Hub
            </h1>
            <p className="text-muted text-sm mt-1">OE Construction Corp</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@oeconstruct.com"
                required
                className="w-full px-3 py-2 bg-black-soft border border-border rounded text-text placeholder-muted/50 focus:outline-none focus:border-cat-yellow transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-black-soft border border-border rounded text-text placeholder-muted/50 focus:outline-none focus:border-cat-yellow transition-colors"
              />
            </div>

            {error && (
              <div className="text-svc-red text-sm bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-cat-yellow text-black font-display font-bold uppercase tracking-wider rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
