import type { ReactNode } from "react";

/**
 * Applies agro palette tokens to public pages (welcome, login) regardless of
 * company uiThemePreset on the root layout.
 */
export function PublicAgroShell(props: {
  children: ReactNode;
  className?: string;
}) {
  const { children, className = "" } = props;
  return (
    <div
      className={`public-agro-theme flex flex-col text-foreground ${className}`.trim()}
    >
      {children}
    </div>
  );
}
