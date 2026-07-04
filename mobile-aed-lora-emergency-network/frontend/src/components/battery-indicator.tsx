export function BatteryIndicator({ level }: { level: number }) {
  const color = level >= 50 ? "bg-emerald-500" : level >= 20 ? "bg-amber-500" : "bg-red-600";
  return (
    <div className="flex items-center gap-2 text-sm text-black">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, level))}%` }} />
      </div>
      <span className="font-semibold">{level}%</span>
    </div>
  );
}
