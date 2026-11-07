"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const ApiContext = createContext(null);

export function useApi() {
  return useContext(ApiContext);
}

export function ApiProvider({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState({ state: "idle" });
  const [me, setMe] = useState(null);

  const request = useCallback(
    async (path, { method = "GET", body } = {}) => {
      setStatus({ state: "loading" });
      const start = performance.now();
      const token = localStorage.getItem("token");

      let response;
      try {
        response = await fetch(API_URL + path, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Token ${token}` }),
          },
          body: body && JSON.stringify(body),
        });
      } catch {
        setStatus({ state: "error", label: "API offline" });
        throw new Error("Could not reach the API. Is the backend running?");
      }

      const ms = Math.round(performance.now() - start);
      setStatus({
        state: response.ok ? "success" : "error",
        label: `${response.status} ${response.ok ? "OK" : "Error"} · ${ms} ms`,
      });

      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        localStorage.removeItem("token");
        setMe(null);
        router.replace("/");
      }
      if (!response.ok) {
        // Field errors arrive as { field: [messages] }; keep them on the error for forms.
        const firstFieldError =
          data && typeof data === "object" ? Object.values(data).flat()[0] : null;
        const error = new Error(
          data?.non_field_errors?.[0] || data?.detail || firstFieldError || "Request failed."
        );
        error.data = data;
        throw error;
      }
      return data;
    },
    [router]
  );

  const loadMe = useCallback(async () => {
    try {
      setMe(await request("/me/"));
    } catch {
      setMe(null);
    }
  }, [request]);

  useEffect(() => {
    if (localStorage.getItem("token")) loadMe();
  }, [loadMe]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setMe(null);
    router.replace("/");
  }, [router]);

  const can = useCallback((code) => Boolean(me?.permissions?.includes(code)), [me]);

  return (
    <ApiContext.Provider value={{ request, status, me, loadMe, logout, can }}>
      {children}
    </ApiContext.Provider>
  );
}
