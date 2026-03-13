import type { Metadata, Viewport } from "next";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cursor Remote Control",
  description: "Control Cursor IDE from any device on your local network",
  appleWebApp: {
    capable: true,
    title: "Cursor Remote",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="overscroll-none">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
