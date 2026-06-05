import { SubTwitchPanel } from "@/components/dashboard/SubTwitchPanel";

export default async function SubTwitchPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <SubTwitchPanel guildId={guildId} />;
}
