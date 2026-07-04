"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isAdminLoggedIn } from "@/lib/admin-auth";

const publicLinks = [
  { href: "/registration", label: "הרשמה" },
  { href: "/login", label: "התחברות" },
  { href: "/lora-info", label: "LoRa" },
];

const adminLinks = [
  { href: "/", label: "דף הבית" },
  { href: "/simulator", label: "סימולטור" },
  { href: "/technology", label: "טכנולוגיה" },
  { href: "/admin", label: "ניהול" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isVolunteerApp = pathname.startsWith("/volunteer");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(isAdminLoggedIn());
    const onStorage = () => setIsAdmin(isAdminLoggedIn());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [pathname]);

  if (isVolunteerApp) {
    return <div className="mx-auto min-h-full w-full bg-[#eef2f7]">{children}</div>;
  }

  const navLinks = isAdmin ? [...adminLinks, ...publicLinks.filter((l) => l.href !== "/login")] : publicLinks;
  const logoHref = isAdmin ? "/" : "/login?role=admin";

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-300 bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href={logoHref} className="text-lg font-bold text-red-700">
            Mobile AED LoRa Network
          </Link>
          <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-red-50 hover:text-red-800"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-slate-300 bg-white py-4 text-center text-sm font-medium text-black">
        פרויקט קורס · סימולטור AED + LoRa · התקשרו ל-101
      </footer>
    </>
  );
}
