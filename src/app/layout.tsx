import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Closet Design Tool",
  description: "Interactive closet design tool – Organized Living",
};

export default function RootLayout({ 
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
