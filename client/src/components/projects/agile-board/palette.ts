/** Shared palette and status helpers for PM Agile board views. */
import { useMemo } from "react";
import { useTheme } from "@/hooks/use-theme";

export const AGILE_PALETTE_LIGHT = {
  navy: "#1B3A6B", blue: "#2563EB", blueMid: "#3B82F6", blueLight: "#DBEAFE",
  teal: "#0EA5E9", tealLight: "#E0F2FE", purple: "#7C3AED", purpleLight: "#EDE9FE",
  green: "#16A34A", greenLight: "#DCFCE7", amber: "#D97706", amberLight: "#FEF3C7",
  red: "#DC2626", redLight: "#FEE2E2",
  grey50: "#F8FAFC", grey100: "#F1F5F9", grey200: "#E2E8F0", grey300: "#CBD5E1",
  grey400: "#94A3B8", grey500: "#64748B", grey600: "#475569", grey700: "#334155",
  grey800: "#1E293B", white: "#FFFFFF",
} as const;

/** Dark-mode surfaces aligned with app slate theme */
export const AGILE_PALETTE_DARK = {
  navy: "#0F172A", blue: "#60A5FA", blueMid: "#3B82F6", blueLight: "#1E3A5F",
  teal: "#38BDF8", tealLight: "#0C4A6E", purple: "#A78BFA", purpleLight: "#3B0764",
  green: "#4ADE80", greenLight: "#052E16", amber: "#FBBF24", amberLight: "#451A03",
  red: "#F87171", redLight: "#450A0A",
  grey50: "#0F172A", grey100: "#1E293B", grey200: "#334155", grey300: "#475569",
  grey400: "#64748B", grey500: "#94A3B8", grey600: "#CBD5E1", grey700: "#E2E8F0",
  grey800: "#F1F5F9", white: "#1E293B",
} as const;

export type AgilePalette = Record<keyof typeof AGILE_PALETTE_LIGHT, string>;

/** @deprecated Prefer useAgilePalette() for theme-aware colors */
export const AGILE_PALETTE = AGILE_PALETTE_LIGHT;

export function getAgilePalette(dark: boolean): AgilePalette {
  return dark ? AGILE_PALETTE_DARK : AGILE_PALETTE_LIGHT;
}

export function useAgilePalette(): AgilePalette {
  const { resolvedTheme } = useTheme();
  return useMemo(() => getAgilePalette(resolvedTheme === "dark"), [resolvedTheme]);
}

export const AGILE_BOARD_COLUMNS = ["To Do", "In Progress", "Review", "Testing", "Done"] as const;

export const priorityColor = (p: string, C: AgilePalette = AGILE_PALETTE_LIGHT) =>
  ({ Critical: C.red, High: C.amber, Medium: C.blue, Low: C.grey400 } as Record<string, string>)[p] || C.grey400;

export const priorityBg = (p: string, C: AgilePalette = AGILE_PALETTE_LIGHT) =>
  ({ Critical: C.redLight, High: C.amberLight, Medium: C.blueLight, Low: C.grey100 } as Record<string, string>)[p] || C.grey100;

export const statusColor = (s: string, C: AgilePalette = AGILE_PALETTE_LIGHT) =>
  ({
    Done: C.green, "In Progress": C.blue, "To Do": C.grey500,
    Backlog: C.grey400, Review: C.purple, Testing: C.teal,
    Active: C.green, Planning: C.amber, Closed: C.grey500,
    Planned: C.teal, Fixed: C.teal, New: C.amber,
    Triaged: C.blue, Verified: C.green,
  } as Record<string, string>)[s] || C.grey400;

export const statusBg = (s: string, C: AgilePalette = AGILE_PALETTE_LIGHT) =>
  ({
    Done: C.greenLight, "In Progress": C.blueLight, "To Do": C.grey100,
    Backlog: C.grey100, Review: C.purpleLight, Testing: C.tealLight,
    Active: C.greenLight, Planning: C.amberLight, Closed: C.grey100,
    Planned: C.tealLight, Fixed: C.tealLight, New: C.amberLight,
    Triaged: C.blueLight, Verified: C.greenLight,
  } as Record<string, string>)[s] || C.grey100;

export const tshirtBg = (t: string, C: AgilePalette = AGILE_PALETTE_LIGHT) =>
  ({
    XS: C.greenLight, S: C.greenLight, M: C.blueLight, L: C.amberLight, XL: C.redLight, XXL: C.purpleLight,
  } as Record<string, string>)[t] || C.grey100;

export const tshirtColor = (t: string, C: AgilePalette = AGILE_PALETTE_LIGHT) =>
  ({ XS: C.green, S: C.green, M: C.blue, L: C.amber, XL: C.red, XXL: C.purple } as Record<string, string>)[t] || C.grey700;
