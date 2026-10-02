import type { Metadata } from "next";
import localFont from "next/font/local";
import { Instrument_Serif } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";
import Nav from "@/components/Nav";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Alpha Quest",
  description: "Quests verified with Primus zkTLS. Log in with X or Discord.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${display.variable} antialiased`}>
        <Script src="/zktls-bundle.js" strategy="beforeInteractive" />
        <Script src="/primus_zk.js" strategy="beforeInteractive" />
        <Script src="/client_plugin.js" strategy="beforeInteractive" />
        <Providers>
          <Nav />
          <main className="shell">{children}</main>
          <footer className="site-foot">
            <span>Alpha Quest</span>
            <span>Session stays yours · Primus zkTLS</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
