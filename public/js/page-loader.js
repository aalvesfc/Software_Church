const style = document.createElement('style')
style.textContent = `
  #page-loader {
    position: fixed;
    inset: 0;
    background: var(--canvas, #fff);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    transition: opacity 0.3s ease;
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
document.head.appendChild(style)

const loader = document.createElement('div')
loader.id = 'page-loader'
loader.innerHTML = `
  <svg viewBox="25 25 50 50">
    <circle r="20" cy="50" cx="50"></circle>
  </svg>
`

function _injectLoader() {
  if (document.body) document.body.prepend(loader)
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
  setTimeout(() => el.remove(), 300)
}

window.hideLoader = function () {
  _dismissLoader()
}

setTimeout(_dismissLoader, 5000)
