import { ModuleForm } from "@/components/dashboard/ModuleForm";
import { moduleByKey } from "@/lib/modules";

export default async function LeavePage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <ModuleForm guildId={guildId} definition={moduleByKey.leave} />;
}
