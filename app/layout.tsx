import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ricardinn98 Dashboard",
  description: "Painel de gerenciamento do bot Discord Ricardinn98."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
