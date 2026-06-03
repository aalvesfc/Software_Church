// lib/uploadUtils.js
// Utilitário centralizado para upload de fotos no Supabase Storage
// SEC-001: valida MIME type antes de qualquer operação de upload

const { supabaseAdmin } = require('./supabase')

// Tipos de imagem permitidos — nada além disso é aceito
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// Mapeamento fixo de MIME → extensão (nunca usa o que veio do atacante)
const EXT_MAP = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
}

// Limite de 5MB por foto
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Faz upload de uma foto em base64 para o bucket 'voluntarios'.
 * Retorna a URL pública, ou null se o upload falhar ou for rejeitado.
 *
 * @param {string} base64Data  - Data URI completo: "data:image/jpeg;base64,..."
 * @param {string} memberId    - ID do membro (usado no nome do arquivo)
 * @returns {Promise<string|null>}
 */
async function uploadPhoto(base64Data, memberId) {
  try {
    // 1. Extrai MIME type e dados base64 do Data URI
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/)
    if (!matches) {
      console.warn('[photo upload] formato inválido — não é um Data URI válido')
      return null
    }

    const contentType = matches[1]

    // 2. Valida que o MIME type é uma imagem permitida
    //    Rejeita qualquer coisa que não seja jpeg/png/webp/gif
    if (!ALLOWED_TYPES.includes(contentType)) {
      console.warn('[photo upload] tipo rejeitado:', contentType)
      return null
    }

    // 3. Converte base64 para Buffer
    const buffer = Buffer.from(matches[2], 'base64')

    // 4. Valida tamanho máximo de 5MB
    if (buffer.length > MAX_BYTES) {
      console.warn('[photo upload] arquivo muito grande:', buffer.length, 'bytes')
      return null
    }

    // 5. Usa extensão do mapa fixo — nunca da string do atacante
    const ext = EXT_MAP[contentType]
    const fileName = `photos/${memberId}-${Date.now()}.${ext}`

    // 6. Garante que o bucket existe (ignora erro se já existir)
    await supabaseAdmin.storage
      .createBucket('voluntarios', { public: true })
      .catch(() => {})

    // 7. Faz o upload com o contentType validado
    const { error } = await supabaseAdmin.storage
      .from('voluntarios')
      .upload(fileName, buffer, { contentType, upsert: true })

    if (error) {
      console.error('[photo upload] erro no storage:', error)
      return null
    }

    // 8. Retorna a URL pública do arquivo
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('voluntarios')
      .getPublicUrl(fileName)

    return publicUrl
  } catch (e) {
    console.error('[photo upload] exceção:', e)
    return null
  }
}

/**
 * Faz upload de uma foto do carrossel de login para o bucket 'login-carousel'.
 * Retorna a URL pública ou null em caso de erro.
 *
 * @param {string} base64Data - Data URI: "data:image/jpeg;base64,..."
 * @param {number} slideIndex - Número do slide (1, 2 ou 3)
 * @param {string} churchId   - ID da igreja (para isolar arquivos por tenant)
 * @returns {Promise<string|null>}
 */
async function uploadCarouselPhoto(base64Data, slideIndex, churchId) {
  try {
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/)
    if (!matches) {
      console.warn('[carousel upload] formato inválido')
      return null
    }

    const contentType = matches[1]
    if (!ALLOWED_TYPES.includes(contentType)) {
      console.warn('[carousel upload] tipo rejeitado:', contentType)
      return null
    }

    const buffer = Buffer.from(matches[2], 'base64')
    if (buffer.length > MAX_BYTES) {
      console.warn('[carousel upload] arquivo muito grande:', buffer.length, 'bytes')
      return null
    }

    const ext      = EXT_MAP[contentType]
    const fileName = `${churchId}/slide-${slideIndex}.${ext}`

    await supabaseAdmin.storage
      .createBucket('login-carousel', { public: true })
      .catch(() => {})

    const { error } = await supabaseAdmin.storage
      .from('login-carousel')
      .upload(fileName, buffer, { contentType, upsert: true })

    if (error) {
      console.error('[carousel upload] erro no storage:', error)
      return null
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('login-carousel')
      .getPublicUrl(fileName)

    return publicUrl
  } catch (e) {
    console.error('[carousel upload] exceção:', e)
    return null
  }
}

module.exports = { uploadPhoto, uploadCarouselPhoto }
