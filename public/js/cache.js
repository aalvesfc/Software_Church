const CACHE_TTL = {
  ministerios:  5 * 60 * 1000,
  departamentos: 5 * 60 * 1000,
  funcoes:      5 * 60 * 1000,
  voluntarios:  2 * 60 * 1000,
  templates:   10 * 60 * 1000,
  eventos:      1 * 60 * 1000,
  musicas:     10 * 60 * 1000,
}

window.CacheManager = {
  set(key, data) {
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify({ data, timestamp: Date.now() }))
    } catch (_) {}
  },

  get(key) {
    try {
      const cached = JSON.parse(localStorage.getItem(`cache_${key}`))
      if (!cached) return null
      const ttl = CACHE_TTL[key] || 5 * 60 * 1000
      if (Date.now() - cached.timestamp > ttl) {
        localStorage.removeItem(`cache_${key}`)
        return null
      }
      return cached.data
    } catch (_) {
      return null
    }
  },

  invalidate(key) {
    localStorage.removeItem(`cache_${key}`)
  },

  clear() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('cache_'))
      .forEach(k => localStorage.removeItem(k))
  }
}
