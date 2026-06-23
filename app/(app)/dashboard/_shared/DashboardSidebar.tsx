import type { ReactNode } from "react";
import { DashboardLineSwitcher } from "./DashboardLineSwitcher";

export async function DashboardSidebar(props: { children: ReactNode }) {
  return (
    <>
      <DashboardLineSwitcher />
      {props.children}
    </>
  );
}
