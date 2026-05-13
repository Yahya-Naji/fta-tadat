import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind class merger — combines clsx (conditional class lists) with
 * tailwind-merge (deduplicates conflicting Tailwind utilities, e.g.
 * `px-2 px-4` → `px-4`). Used by every UI primitive in `components/ui/`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
