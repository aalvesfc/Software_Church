/**
 * authFetch — wrapper sobre fetch que renova o access_token automaticamente
 * quando recebe 401, usando o refresh_token salvo no localStorage.
 * Usa mutex (_refreshing) para evitar múltiplos refreshes simultâneos.
 * Se o refresh falhar, redireciona para o login.
 */
let _refreshing = null

async function authFetch(url, options = {}) {
  const makeHeaders = () => ({
    'Content-Type': 'application/json',
    ...options.headers,
    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
  })

  let res = await fetch(url, { ...options, headers: makeHeaders() })

  if (res.status === 401) {
    // Se não há refresh em andamento, inicia um
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

    // Todas as chamadas simultâneas aguardam o mesmo refresh
    const refreshed = await _refreshing
    if (!refreshed) return res

    // Repete a requisição com o novo token
    res = await fetch(url, { ...options, headers: makeHeaders() })
  }

  return res
}
