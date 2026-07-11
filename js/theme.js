// Applied immediately (before body paints) to avoid a flash of the wrong theme.
// Include this <script> in <head>, after the stylesheet link.
(function () {
  var saved = localStorage.getItem('devkonek-theme');
  var theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

function toggleTheme() {
  var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('devkonek-theme', next);
  updateThemeButton();
}

function updateThemeButton() {
  var btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
}

document.addEventListener('DOMContentLoaded', updateThemeButton);

function toggleSettingsMenu() {
  const menu = document.getElementById('settings-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', function (e) {
  const menu = document.getElementById('settings-menu');
  const btn = document.getElementById('settings-btn');
  if (!menu || menu.style.display === 'none') return;
  if (!menu.contains(e.target) && e.target !== btn) {
    menu.style.display = 'none';
  }
});
