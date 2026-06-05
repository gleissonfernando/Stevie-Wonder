import { ServerHome } from "@/components/dashboard/ServerHome";

export default async function HomePage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <ServerHome guildId={guildId} />;
}
