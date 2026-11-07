"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/components/ApiProvider";
import UserModal from "@/components/UserModal";

const fieldClass =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none";
const actionClass =
  "rounded-md px-2 py-1 text-xs font-medium hover:bg-slate-100";
const PAGE_SIZE = 10; // must match UserPagination.page_size in backend/users/views.py
const pageButtonClass =
  "rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white";

export default function UsersPage() {
  const { request, me, can } = useApi();
  const [users, setUsers] = useState(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(null); // null, "new", or a user object

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ search, role, status, page });
      try {
        const data = await request(`/users/?${params}`);
        if (ignore) return;
        // A narrower filter can leave the current page past the last one, so step back.
        if (data.results.length === 0 && page > 1) {
          setPage(page - 1);
          return;
        }
        setUsers(data.results);
        setCount(data.count);
        setError("");
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    }, 300);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [search, role, status, page, request, reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const firstShown = (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, count);

  // Admin accounts need manage_admins; nobody can ban themselves.
  const canTouch = (user) => user.role !== "admin" || can("manage_admins");

  async function toggleActive(user) {
    const action = user.is_active ? "ban" : "unban";
    if (!window.confirm(`${action === "ban" ? "Ban" : "Unban"} ${user.username}?`)) return;
    setActionError("");
    try {
      await request(`/users/${user.id}/${action}/`, { method: "POST" });
      refresh();
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Users</h1>
        {can("create_users") && (
          <button
            onClick={() => setEditing("new")}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Add user
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          aria-label="Search users"
          placeholder="Search name, username or email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className={`${fieldClass} sm:flex-1`}
        />
        <select aria-label="Filter by role" value={role} onChange={(e) => {
          setRole(e.target.value);
          setPage(1);
        }} className={fieldClass}>
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="analyst">Analyst</option>
        </select>
        <select aria-label="Filter by status" value={status} onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }} className={fieldClass}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
      {!error && !users && <p className="text-sm text-slate-500">Loading…</p>}

      {!error && users && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 capitalize">{user.role}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${user.is_active ? "bg-emerald-600" : "bg-slate-400"}`} />
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(user.date_joined).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {can("edit_users") && canTouch(user) && (
                        <button onClick={() => setEditing(user)} className={`${actionClass} text-slate-700`}>
                          Edit
                        </button>
                      )}
                      {can("ban_users") && canTouch(user) && user.id !== me?.id && (
                        <button
                          onClick={() => toggleActive(user)}
                          className={`${actionClass} ${user.is_active ? "text-red-700" : "text-emerald-700"}`}
                        >
                          {user.is_active ? "Ban" : "Unban"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No users match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!error && users && count > 0 && (
        <div className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {firstShown}–{lastShown} of {count}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className={pageButtonClass}
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className={pageButtonClass}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {editing && (
        <UserModal
          user={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
