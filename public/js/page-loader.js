const _fromLogin = sessionStorage.getItem('from_login') === '1'
if (_fromLogin) sessionStorage.removeItem('from_login')

// Immediately hide body to prevent flash before loader is injected.
// #page-loader overrides visibility so it stays visible once injected.
const _hideStyle = document.createElement('style')
_hideStyle.textContent = 'body { visibility: hidden !important } #page-loader { visibility: visible !important }'
document.head.appendChild(_hideStyle)

// Match background to the loader color so no color flash between pages
if (_fromLogin) {
  document.documentElement.style.background = '#111'
}

const style = document.createElement('style')

if (_fromLogin) {
  style.textContent = `
  #page-loader {
    position: fixed;
    inset: 0;
    background: #111;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    transition: opacity 0.4s ease;
  }
  #page-loader.hide {
    opacity: 0;
    pointer-events: none;
  }
  #page-loader .pl-card {
    --bg-color: #111;
    background-color: var(--bg-color);
    padding: 1rem 2rem;
    border-radius: 1.25rem;
  }
  #page-loader .pl-loader {
    color: rgb(124, 124, 124);
    font-family: "Plus Jakarta Sans", sans-serif;
    font-weight: 500;
    font-size: 25px;
    box-sizing: content-box;
    height: 40px;
    padding: 10px 10px;
    display: flex;
    border-radius: 8px;
  }
  #page-loader .pl-words {
    overflow: hidden;
    position: relative;
  }
  #page-loader .pl-words::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      #111 10%,
      transparent 30%,
      transparent 70%,
      #111 90%
    );
    z-index: 20;
  }
  #page-loader .pl-word {
    display: block;
    height: 100%;
    padding-left: 6px;
    color: #956afa;
    animation: pl_spin 4s infinite;
  }
  @keyframes pl_spin {
    10%  { transform: translateY(-102%) }
    25%  { transform: translateY(-100%) }
    35%  { transform: translateY(-202%) }
    50%  { transform: translateY(-200%) }
    60%  { transform: translateY(-302%) }
    75%  { transform: translateY(-300%) }
    85%  { transform: translateY(-402%) }
    100% { transform: translateY(-400%) }
  }
  `
} else {
  style.textContent = `
  #page-loader {
    position: fixed;
    inset: 0;
    background: var(--canvas, #fff);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    transition: opacity 0.4s ease;
  }
  #page-loader.hide {
    opacity: 0;
    pointer-events: none;
  }
  #page-loader svg {
    width: 3.25em;
    transform-origin: center;
    animation: pl_rotate 2s linear infinite;
  }
  #page-loader circle {
    fill: none;
    stroke: hsl(280, 99%, 36%);
    stroke-width: 2;
    stroke-dasharray: 1, 200;
    stroke-dashoffset: 0;
    stroke-linecap: round;
    animation: pl_dash 1.5s ease-in-out infinite;
  }
  @keyframes pl_rotate {
    100% { transform: rotate(360deg); }
  }
  @keyframes pl_dash {
    0%   { stroke-dasharray: 1, 200; stroke-dashoffset: 0; }
    50%  { stroke-dasharray: 90, 200; stroke-dashoffset: -35px; }
    100% { stroke-dashoffset: -125px; }
  }
  `
}

document.head.appendChild(style)

const loader = document.createElement('div')
loader.id = 'page-loader'

if (_fromLogin) {
  loader.innerHTML = `
    <div class="pl-card">
      <div class="pl-loader">
        <p>loading</p>
        <div class="pl-words">
          <span class="pl-word">voluntários</span>
          <span class="pl-word">escalas</span>
          <span class="pl-word">membros</span>
          <span class="pl-word">eventos</span>
          <span class="pl-word">voluntários</span>
        </div>
      </div>
    </div>
  `
} else {
  loader.innerHTML = `
    <svg viewBox="25 25 50 50">
      <circle r="20" cy="50" cx="50"></circle>
    </svg>
  `
}

function _injectLoader() {
  if (!document.body) return
  document.body.prepend(loader)
  // Remove the hide style now that the loader is in place covering everything
  _hideStyle.remove()
  document.documentElement.style.background = ''
}

if (document.body) {
  _injectLoader()
} else {
  document.addEventListener('DOMContentLoaded', _injectLoader)
}

function _dismissLoader() {
  const el = document.getElementById('page-loader')
  if (!el) return
  el.classList.add('hide')
  setTimeout(() => el.remove(), 400)
}

window.hideLoader = function () {
  _dismissLoader()
}

setTimeout(_dismissLoader, 8000)
