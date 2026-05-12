/**
 * authFetch — wrapper sobre fetch que renova o access_token automaticamente
 * quando recebe 401, usando o refresh_token salvo no localStorage.
 * Se o refresh também falhar, redireciona para o login.
 */
async function authFetch(url, options = {}) {
  const makeHeaders = () => ({
    'Content-Type': 'application/json',
    ...options.headers,
    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
  })

  let res = await fetch(url, { ...options, headers: makeHeaders() })

  if (res.status === 401) {
    // Tenta renovar o token
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      localStorage.clear()
      window.location.href = '/'
      return res
    }

    const refreshRes = await fetch('/api/auth/refresh', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!refreshRes.ok) {
      localStorage.clear()
      window.location.href = '/'
      return res
    }

    const refreshData = await refreshRes.json()
    localStorage.setItem('access_token',  refreshData.access_token)
    localStorage.setItem('refresh_token', refreshData.refresh_token)

    // Repete a requisição original com o novo token
    res = await fetch(url, { ...options, headers: makeHeaders() })
  }

  return res
}
