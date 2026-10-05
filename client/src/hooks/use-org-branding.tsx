import { useEffect } from "react";
import { useCurrentOrganisation } from "@/hooks/use-jiganto";

function hexToHslChannels(hex: string): string | null {
  const m = /^#?([0-9A-Fa-f]{6})$/.exec(hex.trim());
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Named themes an org can switch to via brandingConfig.theme.
 *
 * "jiganto2026" is the default as of Oct 2026 (promoted from an opt-in
 * preview — see client/src/index.css for the palette itself). "legacy" is
 * the explicit opt-out for any org that wants the original blue theme back;
 * it works "for free" because that palette is still what :root defines —
 * picking "legacy" just means we don't add the theme-jiganto2026 class that
 * overrides it.
 */
export const ORG_THEMES = [
  { value: "jiganto2026", label: "Jiganto 2026 (default)" },
  { value: "legacy", label: "Legacy (pre-2026)" },
] as const;

export type OrgThemeValue = (typeof ORG_THEMES)[number]["value"];

/** Applies organisation theme + primary colour override to the document. */
export function OrgBrandingSync() {
  const { data: organisation } = useCurrentOrganisation();

  useEffect(() => {
    const root = document.documentElement;
    const cfg = organisation?.brandingConfig as
      | { primaryColor?: string; theme?: string }
      | null
      | undefined;

    // Default to the new theme unless the org explicitly opted into "legacy".
    // (Older saved configs with theme: "default" or no theme at all land here too.)
    const wantsJiganto2026 = cfg?.theme !== "legacy";
    const themeChanged = root.classList.contains("theme-jiganto2026") !== wantsJiganto2026;
    if (themeChanged) {
      // Briefly enable transitions on colour-bearing properties so the swap
      // reads as a fade rather than an instant flash, then remove the class
      // so normal interactions (hover, focus rings, etc.) stay instant.
      root.classList.add("theme-transition");
      window.setTimeout(() => root.classList.remove("theme-transition"), 300);
    }

    root.classList.toggle("theme-jiganto2026", wantsJiganto2026);

    // A tenant-picked primaryColor always wins over the theme's own accent,
    // same as it did before named themes existed.
    const channels = cfg?.primaryColor ? hexToHslChannels(cfg.primaryColor) : null;
    if (channels) {
      root.style.setProperty("--primary", channels);
      root.style.setProperty("--ring", channels);
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
    }
  }, [organisation?.brandingConfig]);

  return null;
}
