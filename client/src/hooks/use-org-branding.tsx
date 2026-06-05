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

/** Applies organisation primary colour to CSS variables for sidebar/buttons. */
export function OrgBrandingSync() {
  const { data: organisation } = useCurrentOrganisation();

  useEffect(() => {
    const root = document.documentElement;
    const cfg = organisation?.brandingConfig as { primaryColor?: string } | null | undefined;
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
