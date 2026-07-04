"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminAuthHeaders, clearAdminSession, getAdminToken } from "@/lib/admin-auth";

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const volunteerToken = localStorage.getItem("volunteerToken");
    const accessToken = getAdminToken();

    if (volunteerToken && !accessToken) {
      router.replace("/volunteer");
      return;
    }
    if (!accessToken) {
      router.replace("/login?role=admin");
      return;
    }

    fetch(`${API}/admin/stats`, { headers: adminAuthHeaders() })
      .then((resp) => {
        if (!resp.ok) {
          clearAdminSession();
          router.replace("/login?role=admin");
          return;
        }
        setAllowed(true);
      })
      .catch(() => router.replace("/login?role=admin"));
  }, [router]);

  if (!allowed) {
    return <div className="card text-center font-bold text-black">מאמת הרשאות מנהל...</div>;
  }

  return children;
}
