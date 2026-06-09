/**
 * auth-check.js — Verificação de sessão e contrato para todas as páginas autenticadas.
 * Carregado no <head> de todas as páginas com sidebar.
 *
 * Fluxo por page load:
 *  1. IIFE síncrono: sem token → redireciona imediatamente
 *  2. checkAuth(): valida/renova token + verifica contrato via /api/auth/me
 *  3. setInterval a cada 5 min: repete checkAuth() em background
 */

// Verificação imediata (síncrona): sem token → redireciona antes de renderizar
;(function () {
  if (!localStorage.getItem('access_token')) {
    localStorage.clear()
    location.href = '/'
  }
})()

// ── Constantes ────────────────────────────────────────────────────────────────

const PERMISSIONS_TTL   = 15 * 60 * 1000  // 15 min em ms
const BLOQUEIO_CODES    = ['sem_contrato', 'contrato_bloqueado']

// ── checkContrato ─────────────────────────────────────────────────────────────
// Chama /api/auth/me e verifica se a resposta indica bloqueio de contrato.
// Redireciona para /bloqueado?code=X se necessário.
// Retorna false se bloqueado, true caso contrário.
async function checkContrato() {
  try {
    const token = localStorage.getItem('access_token')
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token },
    })

    if (res.status === 403) {
      const data = await res.json()
      if (BLOQUEIO_CODES.includes(data.code)) {
        window.location.href = '/bloqueado?code=' + encodeURIComponent(data.code)
        return false
      }
    }

    return true
  } catch {
    return true // falha silenciosa — não bloqueia por indisponibilidade
  }
}

// ── checkPermissionsCache ─────────────────────────────────────────────────────
// Sempre chama /api/auth/me (uma vez por page load) para:
//  a) Verificar bloqueio de contrato (sempre)
//  b) Detectar mudança de perfil imediatamente (ex: voluntário → líder)
//  c) Atualizar permissões completas no localStorage (só quando o cache expirou)
async function checkPermissionsCache() {
  const permissions_at = parseInt(localStorage.getItem('permissions_at') || '0')
  const cacheExpirado  = Date.now() - permissions_at > PERMISSIONS_TTL

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
    })

    // ── Verifica bloqueio de contrato ──────────────────────────────────────
    if (res.status === 403) {
      const data = await res.json()
      if (BLOQUEIO_CODES.includes(data.code)) {
        window.location.href = '/bloqueado?code=' + encodeURIComponent(data.code)
        return
      }
      clearSession()
      return
    }

    if (!res.ok) {
      clearSession()
      return
    }

    // Sempre lê o body — necessário para detectar mudança de perfil em tempo real
    const dados = await res.json()
    const perfilNovo     = dados.usuario?.perfil_slug
    const perfilAnterior = localStorage.getItem('perfil_slug')

    // ── Detecta transição de perfil (ex: voluntário promovido a líder) ─────
    if (perfilNovo && perfilNovo !== perfilAnterior) {
      localStorage.setItem('perfil_slug', perfilNovo)

      // Garante modulo_ativo quando transiciona para tipo líder
      const tiposLider = ['lider', 'lider_departamento', 'lider_ministerio']
      if (tiposLider.includes(perfilNovo) && !localStorage.getItem('modulo_ativo')) {
        localStorage.setItem('modulo_ativo', 'lider')
      }

      // Atualiza botão de troca de perfil imediatamente
      if (typeof window.atualizarBotaoTrocarPerfil === 'function') {
        window.atualizarBotaoTrocarPerfil()
      }
    }

    // ── Atualiza permissões completas somente quando cache expirou ────────
    if (cacheExpirado) {
      localStorage.setItem('permissions',    JSON.stringify(dados.usuario.permissions))
      localStorage.setItem('perfil_slug',    perfilNovo)
      localStorage.setItem('permissions_at', Date.now().toString())

      if (typeof window.aplicarMenuPermissoes === 'function') {
        window.aplicarMenuPermissoes()
      }
      if (typeof window.atualizarBotaoTrocarPerfil === 'function') {
        window.atualizarBotaoTrocarPerfil()
      }
    }
  } catch (err) {
    console.error('[auth] erro ao verificar sessão:', err)
  }
}

// ── checkAuth ─────────────────────────────────────────────────────────────────
async function checkAuth() {
  const token         = localStorage.getItem('access_token')
  const expires_at    = localStorage.getItem('expires_at')
  const refresh_token = localStorage.getItem('refresh_token')

  if (!token) {
    clearSession()
    return false
  }

  // Verifica expiração do token (com 60 s de margem)
  const agora  = Math.floor(Date.now() / 1000)
  const expira = parseInt(expires_at || '0')

  if (agora >= expira - 60) {
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

  // Verifica contrato + atualiza permissões se necessário (1 request)
  await checkPermissionsCache()

  return true
}

// ── renovarToken ──────────────────────────────────────────────────────────────
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

// ── clearSession ──────────────────────────────────────────────────────────────
function clearSession() {
  localStorage.clear()
  window.location.href = '/'
}

// Revalida a cada 5 min enquanto a página está aberta
setInterval(async () => {
  await checkAuth()
}, 5 * 60 * 1000)

window.checkAuth      = checkAuth
window.checkContrato  = checkContrato
window.clearSession   = clearSession
