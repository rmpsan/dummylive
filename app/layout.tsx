import type { Metadata } from "next";
import "./globals.css";
import { DummyFooter } from "@/components/dummy-footer";

export const metadata: Metadata = {
  title: "Dummy Live",
  description: "Plataforma de transmissão ao vivo white-label.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        {/* Tipografia premium padrão (clientes podem trocar via KV/JSON). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap"
        />
      </head>
      <body className="flex min-h-full flex-col">
        <div className="flex-1">{children}</div>
        <DummyFooter />
      </body>
    </html>
  );
}
