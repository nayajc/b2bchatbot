import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "B2B Ticket FAQ Assistant",
  description: "AI FAQ assistant for travel agency partners",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
