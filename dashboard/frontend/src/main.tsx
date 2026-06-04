import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
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

class RootErrorBoundary extends Component<{ children: ReactNode }, { message: string }> {
  state = { message: "" };

  static getDerivedStateFromError(error: unknown) {
    return {
      message: error instanceof Error ? error.message : "Erro ao iniciar o dashboard."
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Dashboard render error", error, info);
  }

  render() {
    if (this.state.message) {
      return <BootErrorScreen message={this.state.message} />;
    }

    return this.props.children;
  }
}

const root = createRoot(rootElement);
const renderBootError = (message: string) => root.render(<BootErrorScreen message={message} />);

window.addEventListener("error", (event) => {
  renderBootError(event.error instanceof Error ? event.error.message : event.message || "Erro ao iniciar o dashboard.");
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  renderBootError(reason instanceof Error ? reason.message : "Erro ao carregar o dashboard.");
});

try {
  root.render(
    <StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "Erro ao iniciar o dashboard.";
  renderBootError(message);
}
