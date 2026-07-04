export function AlertChannelStatus({
  cellular,
  meshtastic,
}: {
  cellular: { push: boolean; sms: boolean; reason?: string } | null;
  meshtastic: {
    delivered: boolean;
    gatewayLoraId: string | null;
    meshHops: number;
    deviceState: string;
    reason?: string;
  } | null;
}) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <div className={`rounded-xl border-2 p-3 ${cellular?.push ? "border-sky-400 bg-sky-50" : "border-slate-300 bg-white"}`}>
        <p className="text-xs font-bold uppercase text-black">סלולר</p>
        <p className="mt-1 text-sm font-semibold text-black">
          {cellular?.push ? "✓ Push + SMS נשלחו" : cellular?.reason ?? "לא זמין"}
        </p>
      </div>
      <div className={`rounded-xl border-2 p-3 ${meshtastic?.delivered ? "border-violet-400 bg-violet-50" : "border-slate-300 bg-white"}`}>
        <p className="text-xs font-bold uppercase text-black">Meshtastic / LoRa</p>
        <p className="mt-1 text-sm font-semibold text-black">
          {meshtastic?.delivered
            ? `✓ Gateway ${meshtastic.gatewayLoraId} · ${meshtastic.meshHops} hops · ${meshtastic.deviceState}`
            : meshtastic?.reason ?? "לא זמין"}
        </p>
      </div>
    </div>
  );
}
