export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import AdminGate from "./AdminGate";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}