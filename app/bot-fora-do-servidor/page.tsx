import { ErrorState } from "@/components/dashboard/ErrorState";

export default function BotForaDoServidorPage() {
  return <ErrorState title="Bot nao esta no servidor" message="Adicione o bot ao servidor antes de abrir o painel." />;
}
