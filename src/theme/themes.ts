export type ThemeName = "default" | "adult";

export type ThemeTokens = {
  "--color-text": string;
  "--color-text-secondary": string;
  "--color-primary": string;
  "--color-dark-1": string;
  "--color-dark-2": string;
  "--color-dark-3": string;
  "--color-alert": string;
  "--color-pink": string;
  "--color-deep-orange": string;
  "--color-success": string;
  "--color-light-blue": string;
  "--color-warning": string;
  "--gradient-angle": string;
  "--gradient-start-red-start": string;
  "--gradient-end-red-end": string;

  "--chat-bubble-gradient-angle": string;
  "--chat-bubble-gradient-start": string;
  "--chat-bubble-gradient-mid": string;
  "--chat-bubble-gradient-mid02": string;
  "--chat-bubble-gradient-end": string;

  "--gradient-orange-start": string;
  "--gradient-orange-end": string;
};

export const THEMES: Record<ThemeName, ThemeTokens> = {
  default: {
    "--color-text": "#ffffff",
    "--color-text-secondary": "#9E9E9E",
    "--color-primary": "hsl(341, 95%, 48%)",
    "--color-dark-1": "hsla(225, 14%, 11%, 1)",
    "--color-dark-2": "#1F222A",
    "--color-dark-3": "#35383F",
    "--color-alert": "#DF485E",
    "--color-pink": "#EA1E61",
    "--color-deep-orange": "#FF5726",
    "--color-success": "rgba(74, 222, 128, 1)",
    "--color-light-blue": "rgba(0, 169, 241, 1)",
    "--color-warning": "rgba(250, 204, 21, 1)",
    "--gradient-angle": "180deg",
    "--gradient-start-red-start": "#FF4D67",
    "--gradient-end-red-end": "#FF8395",

    "--chat-bubble-gradient-angle": "180deg",
    "--chat-bubble-gradient-start": "hsla(347, 100%, 65%, 0.15)",
    "--chat-bubble-gradient-mid": "hsla(347, 93%, 63%, 0.13)",
    "--chat-bubble-gradient-mid02": "hsla(349, 97%, 65%, 0.322)",
    "--chat-bubble-gradient-end": "hsla(351, 100%, 65.9%, 0.47)",

    "--gradient-orange-start": "#FB9400",
    "--gradient-orange-end": "#FFAB38",
  },
  adult: {
    "--color-text": "#f5f4ff",
    "--color-text-secondary": "#c9c7f5",
    "--color-primary": "#9f4bff",
    "--color-dark-1": "hsla(225, 14%, 11%, 1)",
    "--color-dark-2": "#14131f",
    "--color-dark-3": "#1e1d29",
    "--color-alert": "#ff4f7d",
    "--color-pink": "#f5009b",
    "--color-deep-orange": "#ff7a59",
    "--color-success": "#4ade80",
    "--color-light-blue": "#7dd3fc",

    "--color-warning": "#facc15",
    "--gradient-angle": "270deg",
    "--gradient-start-red-start": "#7210FF",
    "--gradient-end-red-end": "#9D59FF",

    "--chat-bubble-gradient-angle": "180deg",
    "--chat-bubble-gradient-start": "hsla(265, 100%, 65%, 0.15)",
    "--chat-bubble-gradient-mid": "hsla(265, 93%, 63%, 0.13)",
    "--chat-bubble-gradient-mid02": "hsla(265, 97%, 65%, 0.322)",
    "--chat-bubble-gradient-end": "hsla(265, 100%, 65.9%, 0.47)",

    "--gradient-orange-start": "rgba(255, 123, 0, 1)",
    "--gradient-orange-end": "rgba(255, 59, 212, 1)",
  }
};

export function applyTheme(name: ThemeName) {
  if (typeof document === "undefined") return;
  const tokens = THEMES[name];
  const root = document.documentElement;
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.setAttribute("data-theme", name);
}
