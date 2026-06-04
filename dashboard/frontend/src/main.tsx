import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemento root nao encontrado.");
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "Erro ao iniciar o dashboard.";
  rootElement.innerHTML = `
    <main class="login-screen">
      <section class="login-panel">
        <p class="eyebrow">Live Alerts</p>
        <h1>Live Alerts Dashboard</h1>
        <p>${message}</p>
        <a class="discord-button" href="/api/auth/discord">Entrar com Discord</a>
      </section>
    </main>
  `;
}
