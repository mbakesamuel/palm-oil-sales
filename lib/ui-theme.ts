import type { UiThemePreset } from "@prisma/client";

/** Values allowed on `<html data-ui-theme="…">` (drives CSS in `app/globals.css`). */
export type UiThemeDataAttribute = "default" | "agro";

export function uiThemePresetToDataAttribute(
  preset: UiThemePreset | string | null | undefined,
): UiThemeDataAttribute {
  return preset === "agro" ? "agro" : "default";
}
