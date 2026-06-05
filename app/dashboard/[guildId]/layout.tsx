import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function GuildLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  return <DashboardShell guildId={guildId}>{children}</DashboardShell>;
}
