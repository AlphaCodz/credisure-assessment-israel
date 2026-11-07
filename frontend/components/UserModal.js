"use client";

import { useState } from "react";
import { useApi } from "@/components/ApiProvider";

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500";

// Turn { field: ["message"] } from DRF into { field: "message" }.
function toFieldErrors(err) {
  if (!err.data || typeof err.data !== "object") return { form: err.message };
  const out = {};
  for (const [key, value] of Object.entries(err.data)) {
    const text = [value].flat().join(" ");
    out[key === "non_field_errors" || key === "detail" ? "form" : key] = text;
  }
  return out;
}

function FieldError({ message }) {
  return message ? <p className="mt-1 text-xs text-red-700">{message}</p> : null;
}

export default function UserModal({ user, onClose, onSaved }) {
  const { request, me, can } = useApi();
  const isNew = !user;
  const isSelf = !isNew && me?.id === user.id;
  const roleLocked = !can("assign_roles") || isSelf;

  const [form, setForm] = useState({
    username: user?.username ?? "",
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "analyst",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function set(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const body = { ...form };
    if (!isNew) {
      delete body.username; // usernames are not edited here
      if (!body.password) delete body.password; // blank keeps the current password
      if (body.role === user.role) delete body.role; // only send real role changes
    }

    try {
      if (isNew) await request("/users/", { method: "POST", body });
      else await request(`/users/${user.id}/`, { method: "PATCH", body });
      onSaved();
    } catch (err) {
      setErrors(toFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-lg bg-white p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isNew ? "Add user" : "Edit user"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-900">
            ✕
          </button>
        </div>

        {errors.form && <p role="alert" className="text-sm text-red-700">{errors.form}</p>}

        <label className="block text-sm font-medium">
          Username
          <input
            required={isNew}
            disabled={!isNew}
            value={form.username}
            onChange={set("username")}
            className={inputClass}
          />
          <FieldError message={errors.username} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            First name
            <input value={form.first_name} onChange={set("first_name")} className={inputClass} />
            <FieldError message={errors.first_name} />
          </label>
          <label className="block text-sm font-medium">
            Last name
            <input value={form.last_name} onChange={set("last_name")} className={inputClass} />
            <FieldError message={errors.last_name} />
          </label>
        </div>

        <label className="block text-sm font-medium">
          Email
          <input type="email" value={form.email} onChange={set("email")} className={inputClass} />
          <FieldError message={errors.email} />
        </label>

        <label className="block text-sm font-medium">
          Role
          <select value={form.role} onChange={set("role")} disabled={roleLocked} className={inputClass}>
            <option value="analyst">Analyst</option>
            <option value="manager">Manager</option>
            <option value="admin" disabled={!can("manage_admins")}>
              Admin{!can("manage_admins") ? " (requires manage admins)" : ""}
            </option>
          </select>
          {!can("assign_roles") && <p className="mt-1 text-xs text-slate-500">You cannot change roles.</p>}
          {isSelf && <p className="mt-1 text-xs text-slate-500">You cannot change your own role.</p>}
          <FieldError message={errors.role} />
        </label>

        <label className="block text-sm font-medium">
          {isNew ? "Password" : "New password"}
          <input
            type="password"
            required={isNew}
            autoComplete="new-password"
            placeholder={isNew ? "" : "Leave blank to keep current"}
            value={form.password}
            onChange={set("password")}
            className={inputClass}
          />
          <FieldError message={errors.password} />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : isNew ? "Create user" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
