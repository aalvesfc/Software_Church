// lib/apiError.js
// SEC-006: helper centralizado para erros internos
// Loga o erro completo no servidor mas envia mensagem genérica ao cliente
// Evita expor nomes de tabelas, constraints e estrutura interna do banco

/**
 * Responde com 500 e mensagem genérica, logando o erro real no servidor.
 *
 * @param {object} res      - Response do Express
 * @param {Error|object} error - Erro original (Supabase, JS, etc.)
 * @param {string} context  - Identificador do contexto para o log (ex: 'voluntario GET')
 */
function dbError(res, error, context = '') {
  const msg = error?.message || error?.error_description || String(error)
  console.error(`[DB ERROR]${context ? ' ' + context : ''}:`, msg)
  return res.status(500).json({ error: 'Erro interno. Tente novamente.' })
}

/**
 * Responde com 500 para erros inesperados (catch de exceção).
 *
 * @param {object} res      - Response do Express
 * @param {Error} err       - Exceção capturada
 * @param {string} context  - Identificador do contexto para o log
 */
function serverError(res, err, context = '') {
  console.error(`[SERVER ERROR]${context ? ' ' + context : ''}:`, err?.message || err)
  return res.status(500).json({ error: 'Erro interno. Tente novamente.' })
}

module.exports = { dbError, serverError }
