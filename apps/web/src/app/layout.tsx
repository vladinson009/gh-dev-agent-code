import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevScope — GitHub developer analytics",
  description:
    "Explore developer profiles, repository metrics, language trends, and historical snapshots.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
