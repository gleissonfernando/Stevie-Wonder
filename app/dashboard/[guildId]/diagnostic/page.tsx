import { DiagnosticPanel } from "@/components/dashboard/DiagnosticPanel";

export default async function DiagnosticPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <DiagnosticPanel guildId={guildId} />;
}
