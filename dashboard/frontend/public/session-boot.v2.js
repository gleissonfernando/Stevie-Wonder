(function () {
  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderDashboard(user) {
    var root = document.getElementById("root");
    if (!root) return;

    var username = escapeHtml(user.username || "Usuario");
    var avatar = user.avatar
      ? '<img src="' + escapeHtml(user.avatar) + '" alt="" />'
      : "SW";

    root.innerHTML =
      '<main class="app-shell">' +
      '<section class="main-panel" style="padding-left:0">' +
      '<header class="topbar">' +
      '<div class="topbar-left"><div><p class="eyebrow">Painel do bot</p><span>Gerenciamento do servidor Discord</span></div></div>' +
      '<div class="topbar-actions"><div class="profile-chip"><div>' +
      avatar +
      '</div><span><strong>' +
      username +
      '</strong><small>Online</small></span><a class="logout-button" href="/api/auth/logout">Sair</a></div></div>' +
      '</header>' +
      '<div class="content">' +
      '<section class="hero-row"><div class="hero-copy"><div class="status-pill"><i></i>Sistema operacional</div>' +
      '<h2>Dashboard de controle</h2><p>Acesso liberado. O painel carregou em modo seguro enquanto o app principal inicializa.</p></div></section>' +
      '<section class="cards-list">' +
      '<article class="config-card live-feature-card"><div class="card-content"><div class="card-icon">SW</div><div><div class="card-meta"><span>Sistema</span><b>Online</b></div><h3>Steve Wonder</h3><p>Login confirmado com Discord OAuth2.</p></div></div><a class="card-action link-action" href="/api/auth/me">Ver sessao</a></article>' +
      '<article class="config-card"><div class="card-content"><div class="card-icon">Live</div><div><div class="card-meta"><span>Sistema de Lives</span></div><h3>Configuracoes de lives</h3><p>Acesse as rotas do painel e confira as integracoes.</p></div></div><a class="card-action link-action" href="/api/lives">Abrir</a></article>' +
      '</section></div></section></main>';
  }

  ready(function () {
    var panel = document.querySelector("[data-session-fallback]");
    var status = document.querySelector("[data-session-status]");
    var action = document.querySelector("[data-session-action]");

    if (!panel || !status || !action) return;

    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then(function (response) {
        if (!response.ok) return null;
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.user) {
          status.textContent = "Entre com sua conta Discord para liberar o painel.";
          action.textContent = "Entrar com Discord";
          action.setAttribute("href", "/api/auth/discord");
          return;
        }

        status.textContent = "Acesso liberado como " + data.user.username + ".";
        action.textContent = "Abrir painel";
        action.setAttribute("href", "/dashboard");
        panel.setAttribute("data-authenticated", "true");
        renderDashboard(data.user);
      })
      .catch(function () {
        status.textContent = "Entre com sua conta Discord para liberar o painel.";
        action.textContent = "Entrar com Discord";
        action.setAttribute("href", "/api/auth/discord");
      });
  });
})();
