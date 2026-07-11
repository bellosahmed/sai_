import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Tickets",
  description: "Register, pay, and get your QR ticket.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
