import { redirect } from "next/navigation";

/**
 * /lifecycle was the legacy "five agents end-to-end" page. The new
 * structure has those visualisations live on /dashboard, so we redirect
 * any old links over there. Anyone wanting the theatrical pipeline run
 * should use /upload.
 */
export default function LifecyclePage() {
  redirect("/dashboard");
}
