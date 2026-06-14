"use client";

import React, { type ReactNode, useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";
import "@/i18n";

type I18nProviderProps = {
  children: ReactNode;
};

export function I18nProvider({ children }: I18nProviderProps): React.ReactElement {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (i18next.isInitialized) {
      setIsReady(true);
    }
  }, []);

  if (!isReady) {
    return <>{children}</>;
  }

  return <I18nextProvider i18n={i18next}>{children}</I18nextProvider>;
}
