/** Shared palette and status helpers for PM Agile board views. */
export const AGILE_PALETTE = {
  navy: "#1B3A6B", blue: "#2563EB", blueMid: "#3B82F6", blueLight: "#DBEAFE",
  teal: "#0EA5E9", tealLight: "#E0F2FE", purple: "#7C3AED", purpleLight: "#EDE9FE",
  green: "#16A34A", greenLight: "#DCFCE7", amber: "#D97706", amberLight: "#FEF3C7",
  red: "#DC2626", redLight: "#FEE2E2",
  grey50: "#F8FAFC", grey100: "#F1F5F9", grey200: "#E2E8F0", grey300: "#CBD5E1",
  grey400: "#94A3B8", grey500: "#64748B", grey600: "#475569", grey700: "#334155",
  grey800: "#1E293B", white: "#FFFFFF",
} as const;

export const AGILE_BOARD_COLUMNS = ["To Do", "In Progress", "Review", "Testing", "Done"] as const;

export const priorityColor = (p: string) =>
  ({ Critical: AGILE_PALETTE.red, High: AGILE_PALETTE.amber, Medium: AGILE_PALETTE.blue, Low: AGILE_PALETTE.grey400 } as Record<string, string>)[p] || AGILE_PALETTE.grey400;

export const priorityBg = (p: string) =>
  ({ Critical: AGILE_PALETTE.redLight, High: AGILE_PALETTE.amberLight, Medium: AGILE_PALETTE.blueLight, Low: AGILE_PALETTE.grey100 } as Record<string, string>)[p] || AGILE_PALETTE.grey100;

export const statusColor = (s: string) =>
  ({
    Done: AGILE_PALETTE.green, "In Progress": AGILE_PALETTE.blue, "To Do": AGILE_PALETTE.grey500,
    Backlog: AGILE_PALETTE.grey400, Review: AGILE_PALETTE.purple, Testing: AGILE_PALETTE.teal,
    Active: AGILE_PALETTE.green, Planning: AGILE_PALETTE.amber, Closed: AGILE_PALETTE.grey500,
    Planned: AGILE_PALETTE.teal, Fixed: AGILE_PALETTE.teal, New: AGILE_PALETTE.amber,
    Triaged: AGILE_PALETTE.blue, Verified: AGILE_PALETTE.green,
  } as Record<string, string>)[s] || AGILE_PALETTE.grey400;

export const statusBg = (s: string) =>
  ({
    Done: AGILE_PALETTE.greenLight, "In Progress": AGILE_PALETTE.blueLight, "To Do": AGILE_PALETTE.grey100,
    Backlog: AGILE_PALETTE.grey100, Review: AGILE_PALETTE.purpleLight, Testing: AGILE_PALETTE.tealLight,
    Active: AGILE_PALETTE.greenLight, Planning: AGILE_PALETTE.amberLight, Closed: AGILE_PALETTE.grey100,
    Planned: AGILE_PALETTE.tealLight, Fixed: AGILE_PALETTE.tealLight, New: AGILE_PALETTE.amberLight,
    Triaged: AGILE_PALETTE.blueLight, Verified: AGILE_PALETTE.greenLight,
  } as Record<string, string>)[s] || AGILE_PALETTE.grey100;

export const tshirtBg = (t: string) =>
  ({ XS: "#F0FDF4", S: "#DCFCE7", M: "#DBEAFE", L: "#FEF3C7", XL: "#FEE2E2", XXL: "#FCE7F3" } as Record<string, string>)[t] || AGILE_PALETTE.grey100;

export const tshirtColor = (t: string) =>
  ({ XS: AGILE_PALETTE.green, S: AGILE_PALETTE.green, M: AGILE_PALETTE.blue, L: AGILE_PALETTE.amber, XL: AGILE_PALETTE.red, XXL: "#9D174D" } as Record<string, string>)[t] || AGILE_PALETTE.grey700;
