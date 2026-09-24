import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Code Archaeologist",
  description: "Codebase Intelligence Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}