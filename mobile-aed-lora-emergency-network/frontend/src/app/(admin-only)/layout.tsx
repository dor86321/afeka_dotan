import { RequireAdmin } from "@/components/require-admin";

export default function AdminOnlyLayout({ children }: { children: React.ReactNode }) {
  return <RequireAdmin>{children}</RequireAdmin>;
}
