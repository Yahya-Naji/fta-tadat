"use client";

import * as React from "react";
import type { Persona } from "@/lib/personas";

/**
 * Persona avatar.
 *
 * Tries the persona's `photoUrl` first (CC-licensed portrait from
 * randomuser.me or, if you've staged your own, /personas/{id}.jpg). On
 * load error it falls back to the original gradient-with-initial design.
 *
 * Status ring + activity dot are preserved across both display modes.
 */
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
  const [imgFailed, setImgFailed] = React.useState(false);
  const showPhoto = Boolean(persona.photoUrl) && !imgFailed;

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
      className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden shadow-md ${
        showPhoto ? "bg-gray-200 dark:bg-white/10" : `bg-gradient-to-br ${persona.avatarGradient}`
      } ${ring} ${className}`}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={persona.photoUrl}
          alt={persona.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          style={{ fontSize: size * 0.42 }}
          className="font-bold text-white"
        >
          {persona.initials}
        </span>
      )}
      {status === "running" && (
        <span className="absolute -bottom-1 -right-1 inline-block h-3 w-3 rounded-full border-2 border-[#282C34] bg-amber-400 animate-pulse" />
      )}
      {status === "done" && (
        <span className="absolute -bottom-1 -right-1 inline-block h-3 w-3 rounded-full border-2 border-[#282C34] bg-emerald-400" />
      )}
    </div>
  );
}
