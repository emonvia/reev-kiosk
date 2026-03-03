import type { Metadata } from "next";
import { LocaleProvider, type Locale } from "@/lib/i18n";
import "./globals.css";

const KIOSK_LOCALE = (process.env.KIOSK_LOCALE ?? "en") as Locale;

export const metadata: Metadata = {
  title: "reev Kiosk",
  description:
    "Full-screen EV charging station monitoring kiosk, powered by the reev Partner API.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={KIOSK_LOCALE}>
      <body className="font-sans">
        <LocaleProvider locale={KIOSK_LOCALE}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
