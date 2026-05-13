import type { Persona } from "@/lib/personas";

export function PersonaAvatar({
  persona,
  size = 48,
  status,
  className = "",
}: {
  persona: Persona;
  size?: number;
  status?: "idle" | "running" | "done" | "error";
  className?: string;
}) {
  const ring =
    status === "running"
      ? "ring-2 ring-fta animate-pulse"
      : status === "done"
        ? "ring-2 ring-emerald-400/60"
        : status === "error"
          ? "ring-2 ring-red-400/60"
          : "";
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center rounded-2xl bg-gradient-to-br ${persona.avatarGradient} font-bold text-white shadow-md ${ring} ${className}`}
    >
      <span style={{ fontSize: size * 0.42 }}>{persona.initials}</span>
      {status === "running" && (
        <span className="absolute -bottom-1 -right-1 inline-block h-3 w-3 rounded-full border-2 border-[#282C34] bg-amber-400 animate-pulse" />
      )}
      {status === "done" && (
        <span className="absolute -bottom-1 -right-1 inline-block h-3 w-3 rounded-full border-2 border-[#282C34] bg-emerald-400" />
      )}
    </div>
  );
}
