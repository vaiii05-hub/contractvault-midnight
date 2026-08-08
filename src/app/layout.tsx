import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { VaultHeader } from "@/components/VaultHeader";
import { VaultFooter } from "@/components/VaultFooter";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ContractVault — Private agreements on Midnight",
  description:
    "Two parties, one confidential agreement. The terms stay private — only the seal is ever public.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <VaultHeader />
        <div className="flex-1 bg-[linear-gradient(to_bottom,transparent_55%,rgb(0_0_0/0.28)_100%)]">
          {children}
        </div>
        <VaultFooter />
      </body>
    </html>
  );
}
