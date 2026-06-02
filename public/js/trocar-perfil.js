;(function () {
  const PERFIS_COM_ALTERNANCIA = ['lider_departamento', 'lider_ministerio']

  // ── Injetar CSS ────────────────────────────────────────────────────────────
  const style = document.createElement('style')
  style.textContent = `
    #modalTrocarPerfil {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
    }
    #modalTrocarPerfil .tp-card {
      background: #fff; border-radius: 18px; width: 100%; max-width: 400px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.18); overflow: hidden;
    }
    #modalTrocarPerfil .tp-header {
      padding: 22px 24px 16px;
      border-bottom: 1px solid #e0e0e0;
    }
    #modalTrocarPerfil .tp-title {
      font-size: 17px; font-weight: 700; color: #1d1d1f; letter-spacing: -0.02em;
    }
    #modalTrocarPerfil .tp-sub {
      font-size: 13px; color: #6e6e73; margin-top: 3px;
    }
    #modalTrocarPerfil .tp-options {
      padding: 14px 16px 20px; display: flex; flex-direction: column; gap: 10px;
    }
    #modalTrocarPerfil .tp-opcao {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 16px; border: 1.5px solid #e0e0e0; border-radius: 14px;
      cursor: pointer; transition: border-color 0.15s, background 0.15s;
      user-select: none;
    }
    #modalTrocarPerfil .tp-opcao:hover {
      border-color: #8B5CF6; background: rgba(139,92,246,0.04);
    }
    #modalTrocarPerfil .tp-opcao.active {
      border-color: #8B5CF6; background: rgba(139,92,246,0.06);
    }
    #modalTrocarPerfil .tp-icone {
      font-size: 26px; width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      background: #f5f3f0; border-radius: 10px; flex-shrink: 0;
    }
    #modalTrocarPerfil .tp-info strong {
      font-size: 14px; font-weight: 700; color: #1d1d1f; display: block;
      letter-spacing: -0.01em;
    }
    #modalTrocarPerfil .tp-info p {
      font-size: 12px; color: #6e6e73; margin-top: 2px;
    }
    #modalTrocarPerfil .tp-footer {
      padding: 0 16px 16px; display: flex; justify-content: flex-end;
    }
    #modalTrocarPerfil .tp-cancel {
      height: 36px; padding: 0 16px;
      background: transparent; border: 1.5px solid #e0e0e0;
      border-radius: 9999px; font-size: 13px; font-weight: 600;
      color: #6e6e73; font-family: inherit; cursor: pointer;
      transition: background 0.15s;
    }
    #modalTrocarPerfil .tp-cancel:hover { background: #f5f3f0; color: #1d1d1f; }
  `
  document.head.appendChild(style)

  // ── Injetar modal no body ─────────────────────────────────────────────────
  const modal = document.createElement('div')
  modal.id = 'modalTrocarPerfil'
  modal.style.display = 'none'
  modal.innerHTML = `
    <div class="tp-card">
      <div class="tp-header">
        <div class="tp-title">Trocar Perfil</div>
        <div class="tp-sub">Escolha como deseja acessar o sistema</div>
      </div>
      <div class="tp-options">
        <div class="tp-opcao" id="tpOpcaoLider" data-perfil="lider">
          <div class="tp-icone">👔</div>
          <div class="tp-info">
            <strong>Líder de Departamento</strong>
            <p>Gerenciar escalas, voluntários e departamento</p>
          </div>
        </div>
        <div class="tp-opcao" id="tpOpcaoVoluntario" data-perfil="voluntario">
          <div class="tp-icone">🙋</div>
          <div class="tp-info">
            <strong>Voluntário</strong>
            <p>Ver eventos, check-in e músicas</p>
          </div>
        </div>
      </div>
      <div class="tp-footer">
        <button class="tp-cancel" id="tpCancelar">Cancelar</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)

  // ── Injetar botão no dropdown após "Editar Perfil" ────────────────────────
  function injetarBotao() {
    // Encontra todos os links "Editar Perfil" no dropdown
    const links = document.querySelectorAll('.avatar-dropdown .dropdown-item[href="/editar-perfil"]')
    links.forEach(link => {
      // Evita duplicar se já injetado
      if (link.parentNode.querySelector('#trocarPerfilBtn')) return

      const btn = document.createElement('a')
      btn.href = '#'
      btn.className = 'dropdown-item'
      btn.id = 'trocarPerfilBtn'
      btn.style.display = 'none'
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>Trocar Perfil`
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        // Fecha dropdown
        document.querySelectorAll('.avatar-dropdown.open').forEach(d => d.classList.remove('open'))
        abrirModal()
      })
      link.after(btn)
    })
  }

  // ── Visibilidade do botão ─────────────────────────────────────────────────
  function atualizarBotao() {
    const perfil_slug = localStorage.getItem('perfil_slug')
    const podeAlternar = PERFIS_COM_ALTERNANCIA.includes(perfil_slug)
    document.querySelectorAll('#trocarPerfilBtn').forEach(btn => {
      btn.style.display = podeAlternar ? 'flex' : 'none'
    })
  }

  // ── Modal: abrir / fechar ─────────────────────────────────────────────────
  function abrirModal() {
    const moduloAtivo = localStorage.getItem('modulo_ativo') || 'lider'
    document.getElementById('tpOpcaoLider').classList.toggle('active', moduloAtivo === 'lider')
    document.getElementById('tpOpcaoVoluntario').classList.toggle('active', moduloAtivo === 'voluntario')
    modal.style.display = 'flex'
    document.body.style.overflow = 'hidden'
  }

  function fecharModal() {
    modal.style.display = 'none'
    document.body.style.overflow = ''
  }

  function escolherPerfil(perfilEscolhido) {
    localStorage.setItem('modulo_ativo', perfilEscolhido)

    // Calcula e persiste perfil_efetivo imediatamente
    const perfil_slug = localStorage.getItem('perfil_slug') || ''
    const perfilEfetivo = (
      ['lider_departamento', 'lider_ministerio'].includes(perfil_slug) &&
      perfilEscolhido === 'voluntario'
    ) ? 'voluntario' : perfil_slug
    localStorage.setItem('perfil_efetivo', perfilEfetivo)

    fecharModal()
    if (typeof window.aplicarMenuPermissoes === 'function') {
      window.aplicarMenuPermissoes()
    }
    window.location.href = '/dashboard'
  }

  // ── Event listeners do modal ──────────────────────────────────────────────
  modal.addEventListener('click', (e) => {
    if (e.target === modal) fecharModal()
  })
  document.getElementById('tpCancelar').addEventListener('click', fecharModal)

  document.getElementById('tpOpcaoLider').addEventListener('click', () => escolherPerfil('lider'))
  document.getElementById('tpOpcaoVoluntario').addEventListener('click', () => escolherPerfil('voluntario'))

  // ── Inicialização ─────────────────────────────────────────────────────────
  function init() {
    injetarBotao()
    atualizarBotao()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  // Expõe para ser chamado externamente (ex: após login/troca de permissões)
  window.atualizarBotaoTrocarPerfil = atualizarBotao
})()
