import { CommandManager } from "@/components/dashboard/CommandManager";

export default async function CommandsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <CommandManager guildId={guildId} />;
}
