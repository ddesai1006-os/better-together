import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import "./globals.css";

const nunito = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: "Better Together",
  description: "A shared home operating system — lighten the mental load of running a household, together.",
  // Lets people "Add to Home Screen" and open it like an app.
  appleWebApp: { capable: true, title: "Better Together", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#F9F6F2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // needed for safe-area insets around the iPhone home bar
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
