/**
 * /desk — workspace shell. Wraps every page under /desk with the
 * WorkspaceProvider so persona state + notifications persist across
 * sub-routes (in case we add /desk/notifications etc. later).
 */
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";

export const metadata = {
  title: "Workspace · Q Tax",
  description:
    "Sign in as Layla, Hamad, Maya, Karim or Salma. Each user owns one TADAT POA; handoffs trigger notifications downstream.",
};

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}
