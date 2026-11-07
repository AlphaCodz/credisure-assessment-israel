"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/components/ApiProvider";
import StatusIndicator from "@/components/StatusIndicator";

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none";

export default function LoginPage() {
  const router = useRouter();
  const { request, status, loadMe } = useApi();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (localStorage.getItem("token")) router.replace("/dashboard");
  }, [router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      const data = await request("/login/", {
        method: "POST",
        body: { username, password },
      });
      localStorage.setItem("token", data.token);
      await loadMe();
      router.replace("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <div>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-slate-500">Access the admin dashboard.</p>
        </div>

        <label className="block text-sm font-medium">
          Username
          <input
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-medium">
          Password
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={status.state === "loading"}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {status.state === "loading" ? "Signing in…" : "Sign in"}
        </button>

        <div className="flex justify-center">
          <StatusIndicator />
        </div>
      </form>
    </main>
  );
}
