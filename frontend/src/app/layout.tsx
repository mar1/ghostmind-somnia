import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Spectral } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "GhostMind",
  description: "A reverse Akinator on Somnia. The Oracle picks a famous mind in secret.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${jetbrainsMono.variable} ${spectral.variable} h-full antialiased`}
      style={{
        // Override CSS variables with actual font families
        // @ts-expect-error CSS custom properties
        "--gm-font-display": "var(--font-spectral), Georgia, serif",
        "--gm-font-sans": "var(--font-dm-sans), system-ui, sans-serif",
        "--gm-font-mono": "var(--font-jetbrains-mono), ui-monospace, monospace",
      }}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
