/** Agro / palm-oil monitoring palette — earthy greens and harvest accents. */
export const agro = {
  forest: "#2d5016",
  forestDark: "#1e3610",
  leaf: "#4a7c3f",
  sage: "#7a9e6a",
  moss: "#3d6b22",
  cream: "#f8faf6",
  /** Light sage content background (agro theme). */
  canvas: "#ecf1e6",
  panel: "#ffffff",
  border: "#d8e0d0",
  borderLight: "#e8efe3",
  text: "#1a2e14",
  textMuted: "#5c6b52",
  textSoft: "#8a9682",
  harvest: "#c4a035",
  amber: "#d4a017",
  soil: "#8b6914",
  clay: "#6b5344",
  danger: "#b91c1c",
  dangerSoft: "#fef2f2",
  shadow: "rgba(45, 80, 22, 0.12)",
} as const;

export type AgroIconTone =
  | "forest"
  | "leaf"
  | "sage"
  | "harvest"
  | "amber"
  | "clay"
  | "moss"
  | "palm"
  | "sun";

/** Rounded top corners on the home dashboard sheet (reference layout). */
export const agroHomeSheet = {
  radius: 28,
  backgroundColor: agro.canvas,
} as const;

/** Home grid tile — white rounded card on agro canvas (reference layout). */
export const agroHomeTile = {
  backgroundColor: "#ffffff",
  borderRadius: 20,
} as const;

/** Per-module icon accent on home tiles. */
export type AgroCardTheme = {
  iconBg: string;
  iconFg: string;
  shadow: string;
};

export const agroCardThemes: Record<AgroIconTone, AgroCardTheme> = {
  forest: {
    iconBg: "#d4e4cc",
    iconFg: "#1f4a12",
    shadow: "rgba(45, 80, 22, 0.22)",
  },
  leaf: {
    iconBg: "#c8e6c0",
    iconFg: "#2d6b24",
    shadow: "rgba(61, 107, 34, 0.2)",
  },
  sage: {
    iconBg: "#dce8d0",
    iconFg: "#4a6740",
    shadow: "rgba(90, 120, 74, 0.18)",
  },
  moss: {
    iconBg: "#bdd4b0",
    iconFg: "#234f18",
    shadow: "rgba(35, 79, 24, 0.22)",
  },
  harvest: {
    iconBg: "#f5e4a8",
    iconFg: "#9a7200",
    shadow: "rgba(196, 160, 53, 0.28)",
  },
  amber: {
    iconBg: "#ffe08a",
    iconFg: "#8a6500",
    shadow: "rgba(212, 160, 23, 0.26)",
  },
  clay: {
    iconBg: "#e8d4c4",
    iconFg: "#6b4423",
    shadow: "rgba(107, 83, 68, 0.22)",
  },
  palm: {
    iconBg: "#b8dcc8",
    iconFg: "#1a6b4a",
    shadow: "rgba(26, 107, 74, 0.2)",
  },
  sun: {
    iconBg: "#ffd966",
    iconFg: "#7a5800",
    shadow: "rgba(180, 130, 0, 0.24)",
  },
};

/** @deprecated Use agroCardThemes */
export const agroIconTones: Record<
  AgroIconTone,
  { bg: string; fg: string }
> = Object.fromEntries(
  Object.entries(agroCardThemes).map(([k, v]) => [k, { bg: v.iconBg, fg: v.iconFg }]),
) as Record<AgroIconTone, { bg: string; fg: string }>;
