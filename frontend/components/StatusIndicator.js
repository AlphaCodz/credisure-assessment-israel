"use client";

import { useApi } from "@/components/ApiProvider";

const STYLES = {
  idle: { dot: "bg-slate-400", label: "Idle" },
  loading: { dot: "bg-amber-500 animate-pulse", label: "Loading…" },
  success: { dot: "bg-emerald-600", label: "OK" },
  error: { dot: "bg-red-600", label: "Error" },
};

export default function StatusIndicator() {
  const { status } = useApi();
  const style = STYLES[status.state];

  return (
    <span
      aria-live="polite"
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
    >
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {status.label || style.label}
    </span>
  );
}
