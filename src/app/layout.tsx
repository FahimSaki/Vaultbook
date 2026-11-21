import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { assertLocalHost } from "@/server/portable/host";
import { Heartbeat } from "@/components/Heartbeat";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vaultbook",
  description: "Privacy-first inventory and pricing",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertLocalHost();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Heartbeat />
        {children}
      </body>
    </html>
  );
}
