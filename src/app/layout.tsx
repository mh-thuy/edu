import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactElement, ReactNode } from "react";
import { AppThemeProvider } from "@/components/providers/AppThemeProvider";
import { I18nProvider } from "@/providers/I18nProvider";
import "@/app/globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "Edu Center - Classroom Rental",
  description: "Management platform for classroom rental center",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps): ReactElement {
  return (
    <html lang="en">
      <body className={plusJakartaSans.variable}>
        <I18nProvider>
          <AppThemeProvider>{children}</AppThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
