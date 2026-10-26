import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Crossline",
  title: "Crossline — Crowd Command",
  description:
    "A persistent multiplayer urban crowd simulation. Choose a side. Read the crowd. Hold the line.",
};

export const viewport: Viewport = {
  themeColor: "#101419",
  viewportFit: "cover",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
