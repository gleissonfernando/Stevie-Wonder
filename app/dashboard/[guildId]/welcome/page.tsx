import { ModuleForm } from "@/components/dashboard/ModuleForm";
import { moduleByKey } from "@/lib/modules";

export default async function WelcomePage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <ModuleForm guildId={guildId} definition={moduleByKey.welcome} />;
}
