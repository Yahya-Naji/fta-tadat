import { redirect } from "next/navigation";

/**
 * /desk was the personal inbox. Now folded into /agents/[id] which carries
 * the handover button + notifications inline. Anyone landing here gets
 * redirected to Layla's department; user-switcher inside that page lets
 * them jump to any persona.
 */
export default function DeskRedirect() {
  redirect("/agents/registry");
}
