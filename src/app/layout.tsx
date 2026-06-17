import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { AppThemeProvider } from "@/components/providers/AppThemeProvider";
import { LocalizationWrapper } from "@/components/providers/LocalizationWrapper";

export const metadata: Metadata = {
  title: "Edu Center - Classroom Rental",
  description: "Management platform for classroom rental center",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({
  children,
}: RootLayoutProps): ReactElement {
  return (
    <html lang="en">
      <body>
        <LocalizationWrapper>
          <AppThemeProvider>{children}</AppThemeProvider>
        </LocalizationWrapper>
      </body>
    </html>
  );
}
