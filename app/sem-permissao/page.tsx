import { ErrorState } from "@/components/dashboard/ErrorState";

export default function SemPermissaoPage() {
  return <ErrorState title="Sem permissao" message="Voce nao tem permissao para gerenciar este servidor." />;
}
