export function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" | "ok" }) {
  const tones = {
    default: "border-line bg-white",
    warn: "border-yellow-200 bg-yellow-50",
    ok: "border-emerald-200 bg-emerald-50"
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-ink">{value}</div>
    </div>
  );
}
