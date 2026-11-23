import { requireAdmin } from "@/lib/auth";
import { getPlanPresets } from "@/app/actions/plans";
import StaffHeader from "@/components/admin/StaffHeader";
import PlanManager from "./PlanManager";

export const dynamic = "force-dynamic";

export default async function AdminTischplaenePage({ searchParams }: { searchParams: Promise<{ preset?: string }> }) {
  await requireAdmin(true);
  const [presets, params] = await Promise.all([getPlanPresets(), searchParams]);
  return (
    <div className="min-h-screen bg-base-light pb-12">
      <StaffHeader />
      <PlanManager presets={presets} initialPresetId={params.preset ?? null} />
    </div>
  );
}