"use client";

import * as React from "react";

/**
 * Mount once on a dedicated print route and fire the browser's print dialog.
 * After the dialog closes (or is cancelled) we best-effort close the tab, so the
 * user is back where they started. Some browsers ignore `window.close()` for
 * tabs they didn't open via script; in that case the user closes manually.
 */
export function AutoPrint(props: { delayMs?: number; closeOnFinish?: boolean }) {
  const { delayMs = 150, closeOnFinish = true } = props;

  React.useEffect(() => {
    const handleAfterPrint = () => {
      if (!closeOnFinish) return;
      // Defer slightly so the dialog has fully dismissed.
      window.setTimeout(() => {
        try {
          window.close();
        } catch {
          // Browser blocked close — leave the tab open.
        }
      }, 100);
    };

    window.addEventListener("afterprint", handleAfterPrint);
    const timer = window.setTimeout(() => {
      window.print();
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [delayMs, closeOnFinish]);

  return null;
}
