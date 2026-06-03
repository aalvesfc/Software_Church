/**
 * authFetch — wrapper sobre fetch que:
 * 1. Adiciona o Authorization header automaticamente
 * 2. Renova o access_token via refresh quando recebe 401
 * 3. Redireciona para /bloqueado quando recebe 403 com código de bloqueio de contrato
 */

const _BLOQUEIO_CODES = ['sem_contrato', 'contrato_bloqueado', 'modulo_nao_contratado']

// URLs que NUNCA devem disparar o redirecionamento de bloqueio
const _BLOQUEIO_EXEMPT = [
  '/api/auth/',          // login, refresh, logout, me
  '/api/notificacao/nao-lidas',
  '/api/contrato',       // painel sistema
  '/api/config/sistema', // config do sistema
]

function _isExempt(url) {
  return _BLOQUEIO_EXEMPT.some(p => url.includes(p))
}

let _refreshing = null

async function authFetch(url, options = {}) {
  const makeHeaders = () => ({
    'Content-Type': 'application/json',
    ...options.headers,
    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
  })

  let res = await fetch(url, { ...options, headers: makeHeaders() })

  // ── 403 com código de bloqueio de contrato → tela de bloqueio ────────────
  if (res.status === 403 && !_isExempt(url)) {
    try {
      const clone = res.clone()
      const data  = await clone.json()
      if (_BLOQUEIO_CODES.includes(data.code)) {
        window.location.href = `/bloqueado?code=${encodeURIComponent(data.code)}`
        return res
      }
    } catch (_) { /* body não era JSON — deixa passar normalmente */ }
  }

  // ── 401 → tenta renovar token e repete a requisição ──────────────────────
  if (res.status === 401) {
    if (!_refreshing) {
      _refreshing = (async () => {
        const refreshToken = localStorage.getItem('refresh_token')
        if (!refreshToken) {
          localStorage.clear()
          window.location.href = '/'
          return false
        }
        const refreshRes = await fetch('/api/auth/refresh', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refresh_token: refreshToken }),
        })
        if (!refreshRes.ok) {
          localStorage.clear()
          window.location.href = '/'
          return false
        }
        const d = await refreshRes.json()
        localStorage.setItem('access_token',  d.access_token)
        localStorage.setItem('refresh_token', d.refresh_token)
        if (d.expires_at) localStorage.setItem('expires_at', d.expires_at)
        return true
      })().finally(() => { _refreshing = null })
    }

    const refreshed = await _refreshing
    if (!refreshed) return res

    res = await fetch(url, { ...options, headers: makeHeaders() })
  }

  return res
}
