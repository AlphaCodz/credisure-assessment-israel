"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApi } from "@/components/ApiProvider";
import StatusIndicator from "@/components/StatusIndicator";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/permissions", label: "Permissions", requires: "manage_permissions" },
];

export default function Nav() {
  const pathname = usePathname();
  const { can, logout } = useApi();
  const [open, setOpen] = useState(false);

  const links = LINKS.filter((link) => !link.requires || can(link.requires)).map((link) => (
    <Link
      key={link.href}
      href={link.href}
      onClick={() => setOpen(false)}
      className={`rounded-md px-3 py-2 text-sm font-medium ${
        pathname === link.href
          ? "bg-slate-100 text-slate-900"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {link.label}
    </Link>
  ));

  const logoutButton = (
    <button
      onClick={logout}
      className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
    >
      Log out
    </button>
  );

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Dashboard</span>
          <nav className="hidden items-center gap-1 md:flex">{links}</nav>
        </div>

        <div className="flex items-center gap-2">
          <StatusIndicator />
          <div className="hidden md:block">{logoutButton}</div>
          <button
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-slate-200 p-2 md:hidden">
          {links}
          {logoutButton}
        </nav>
      )}
    </header>
  );
}
