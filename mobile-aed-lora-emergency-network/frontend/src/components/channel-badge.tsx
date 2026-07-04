export function ChannelBadge({ channel }: { channel: string }) {
  const styles: Record<string, string> = {
    BOTH: "bg-emerald-100 text-emerald-900 border-emerald-300",
    CELLULAR: "bg-sky-100 text-sky-900 border-sky-300",
    LORA: "bg-violet-100 text-violet-900 border-violet-300",
    OFFLINE: "bg-slate-200 text-black border-slate-400",
  };
  const labels: Record<string, string> = {
    BOTH: "סלולר + LoRa",
    CELLULAR: "סלולר",
    LORA: "LoRa",
    OFFLINE: "לא זמין",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${styles[channel] ?? styles.OFFLINE}`}>
      {labels[channel] ?? channel}
    </span>
  );
}
