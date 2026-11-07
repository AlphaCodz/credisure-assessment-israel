"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/components/ApiProvider";

export default function OverviewPage() {
  const { request } = useApi();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request("/dashboard/").then(setStats).catch((err) => setError(err.message));
  }, [request]);

  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!stats) return <p className="text-sm text-slate-500">Loading…</p>;

  const tiles = [
    { label: "Total users", value: stats.total },
    { label: "Active", value: stats.active },
    { label: "Inactive", value: stats.inactive },
    { label: "Admins", value: stats.admins },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Overview</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">{tile.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{tile.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">
          Recently joined
        </h2>
        <ul className="divide-y divide-slate-100">
          {stats.recent.map((user) => (
            <li key={user.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="min-w-0 truncate">
                {user.name} <span className="text-slate-500">· {user.email}</span>
              </span>
              <span className="shrink-0 text-slate-500">
                {new Date(user.date_joined).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
