import { ErrorState } from "@/components/dashboard/ErrorState";

export default function ErroAutenticacaoPage() {
  return <ErrorState title="Erro de autenticacao" message="Nao foi possivel concluir o login com Discord." />;
}
