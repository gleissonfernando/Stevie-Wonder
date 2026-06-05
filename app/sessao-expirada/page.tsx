import { ErrorState } from "@/components/dashboard/ErrorState";

export default function SessaoExpiradaPage() {
  return <ErrorState title="Sessao expirada" message="Entre com Discord novamente para continuar." />;
}
