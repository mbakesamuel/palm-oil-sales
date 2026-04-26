"use client";

import * as React from "react";

export type BrandingValue = {
  companyName: string;
  department: string | null;
};

const BrandingContext = React.createContext<BrandingValue | null>(null);

export function BrandingProvider({
  value,
  children,
}: {
  value: BrandingValue;
  children: React.ReactNode;
}) {
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingValue {
  const v = React.useContext(BrandingContext);
  if (!v) {
    return { companyName: "Palm Oil Sales", department: null };
  }
  return v;
}
