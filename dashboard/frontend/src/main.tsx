import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Bot, LogIn } from "lucide-react";
import App from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemento root nao encontrado.");
}

function BootErrorScreen({ message }: { message: string }) {
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="logo-mark">
          <Bot size={34} />
        </div>
        <p className="eyebrow">Live Alerts</p>
        <h1>Live Alerts Dashboard</h1>
        <p className="login-copy">{message}</p>
        <a className="discord-button" href="/api/auth/discord">
          <LogIn size={19} />
          Entrar com Discord
        </a>
      </section>
    </main>
  );
}

const root = createRoot(rootElement);

try {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "Erro ao iniciar o dashboard.";
  root.render(<BootErrorScreen message={message} />);
}
