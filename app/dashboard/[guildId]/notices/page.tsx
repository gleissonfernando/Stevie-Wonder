import { NoticeForm } from "@/components/dashboard/NoticeForm";

export default async function NoticesPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <NoticeForm guildId={guildId} />;
}
