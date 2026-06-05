import { ErrorState } from "@/components/dashboard/ErrorState";

export default function NotFound() {
  return <ErrorState title="404" message="Pagina nao encontrada." />;
}
