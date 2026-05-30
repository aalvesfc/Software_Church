/**
 * auth-check.js — Verificação de sessão para todas as páginas autenticadas.
 * Carregado no <head> de todas as páginas com sidebar.
 */

// Verificação imediata (síncrona): se não há token, redireciona antes de renderizar
;(function () {
  if (!localStorage.getItem('access_token')) {
    localStorage.clear()
    location.href = '/'
  }
})()

// ── Constantes ────────────────────────────────────────────────────────────────

const PERMISSIONS_TTL = 15 * 60 * 1000 // 15 minutos em ms

// ── Funções exportadas ────────────────────────────────────────────────────────

/**
 * Verifica se o cache de permissões expirou (TTL 15 min).
 * Se expirado, rebusca /api/auth/me e atualiza localStorage + reaplica menu.
 */
async function checkPermissionsCache() {
  const permissions_at = parseInt(localStorage.getItem('permissions_at') || '0')
  const expirado = Date.now() - permissions_at > PERMISSIONS_TTL

  if (!expirado) return // ainda válido

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') }
    })

    if (!res.ok) {
      clearSession()
      return
    }

    const dados = await res.json()

    localStorage.setItem('permissions',    JSON.stringify(dados.usuario.permissions))
    localStorage.setItem('perfil_slug',    dados.usuario.perfil_slug)
    localStorage.setItem('permissions_at', Date.now().toString())

    // Reaplica sidebar com as permissões atualizadas
    if (window.aplicarMenuPermissoes) {
      window.aplicarMenuPermissoes()
    }
  } catch (err) {
    console.error('[auth] erro ao rebuscar permissões:', err)
  }
}

async function checkAuth() {
  const token         = localStorage.getItem('access_token')
  const expires_at    = localStorage.getItem('expires_at')
  const refresh_token = localStorage.getItem('refresh_token')

  // Sem token → redireciona para login
  if (!token) {
    clearSession()
    return false
  }

  // Verifica se expirou (com 60 segundos de margem)
  const agora  = Math.floor(Date.now() / 1000)
  const expira = parseInt(expires_at || '0')

  if (agora >= expira - 60) {
    // Tenta renovar
    if (!refresh_token) {
      clearSession()
      return false
    }
    const renovado = await renovarToken(refresh_token)
    if (!renovado) {
      clearSession()
      return false
    }
  }

  // Verifica cache de permissões (TTL 15 min)
  await checkPermissionsCache()

  return true
}

async function renovarToken(refresh_token) {
  try {
    const res = await fetch('/api/auth/refresh', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token }),
    })
    if (!res.ok) return false
    const dados = await res.json()
    localStorage.setItem('access_token',  dados.access_token)
    localStorage.setItem('refresh_token', dados.refresh_token)
    localStorage.setItem('expires_at',    dados.expires_at)
    return true
  } catch {
    return false
  }
}

function clearSession() {
  localStorage.clear()
  window.location.href = '/'
}

// Verifica a cada 5 minutos enquanto a página está aberta
setInterval(async () => {
  await checkAuth()
}, 5 * 60 * 1000)

window.checkAuth    = checkAuth
window.clearSession = clearSession
