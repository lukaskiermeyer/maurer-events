import TeamHeader from "@/components/team/TeamHeader";

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-base-light pb-12">
      <TeamHeader />
      <div className="max-w-[1100px] mx-auto px-4 pt-6">{children}</div>
    </div>
  );
}