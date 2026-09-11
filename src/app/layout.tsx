import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";
import Nav from "@/components/Nav";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Alpha Quest",
  description: "Quests verified with Primus zkTLS. Log in with X or Discord.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased text-slate-100`}>
        <Script src="/zktls-bundle.js" strategy="beforeInteractive" />
        <Script src="/primus_zk.js" strategy="beforeInteractive" />
        <Script src="/client_plugin.js" strategy="beforeInteractive" />
        <Providers>
          <Nav />
          <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-5 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
