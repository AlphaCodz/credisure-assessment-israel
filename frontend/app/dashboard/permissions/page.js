"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/components/ApiProvider";

const ROLES = ["admin", "manager", "analyst"];

const LABELS = {
  create_users: "Create users",
  edit_users: "Edit user details",
  ban_users: "Ban and unban users",
  assign_roles: "Change user roles",
  manage_admins: "Manage admin accounts",
  manage_permissions: "Change role permissions",
};

function sameSet(a, b) {
  return a.length === b.length && a.every((code) => b.includes(code));
}

export default function PermissionsPage() {
  const { request, me, can } = useApi();
  const [saved, setSaved] = useState(null); // { role: [codes] } as the server has it
  const [draft, setDraft] = useState(null); // same shape, with unsaved edits
  const [allPermissions, setAllPermissions] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!can("manage_permissions")) return;
    request("/role-permissions/")
      .then((data) => {
        setSaved(data.roles);
        setDraft(data.roles);
        setAllPermissions(data.all_permissions);
      })
      .catch((err) => setError(err.message));
  }, [request, can]);

  if (me && !can("manage_permissions")) {
    return <p className="text-sm text-slate-600">You do not have access to this page.</p>;
  }
  if (!draft) {
    return error ? (
      <p role="alert" className="text-sm text-red-700">{error}</p>
    ) : (
      <p className="text-sm text-slate-500">Loading…</p>
    );
  }

  const changedRoles = ROLES.filter((role) => !sameSet(saved[role], draft[role]));

  function toggle(role, code) {
    setDraft((d) => ({
      ...d,
      [role]: d[role].includes(code) ? d[role].filter((c) => c !== code) : [...d[role], code],
    }));
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      let latest = null;
      for (const role of changedRoles) {
        latest = await request("/role-permissions/", {
          method: "PUT",
          body: { role, permissions: draft[role] },
        });
      }
      setSaved(latest.roles);
      setDraft(latest.roles);
      setMessage("Permissions saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Role permissions</h1>
          <p className="text-sm text-slate-500">Choose what each role is allowed to do.</p>
        </div>
        <button
          onClick={save}
          disabled={saving || changedRoles.length === 0}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Permission</th>
              {ROLES.map((role) => (
                <th key={role} className="px-4 py-3 text-center font-medium capitalize">{role}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allPermissions.map((code) => (
              <tr key={code}>
                <td className="px-4 py-3">{LABELS[code] || code}</td>
                {ROLES.map((role) => {
                  const locked = role === "admin" && code === "manage_permissions";
                  return (
                    <td key={role} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${LABELS[code] || code} for ${role}`}
                        checked={draft[role].includes(code)}
                        disabled={locked || saving}
                        onChange={() => toggle(role, code)}
                        title={locked ? "Admins always keep this, so permissions can't be locked out" : undefined}
                        className="h-4 w-4 accent-slate-900"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
