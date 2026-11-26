import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { SmoothScroll } from "@/components/common/SmoothScroll";
import { CustomCursor } from "@/components/common/CustomCursor";

export const metadata: Metadata = {
  title: `${siteConfig.name} — AI Voice Authenticity Detector`,
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-ink text-white antialiased selection:bg-bonafide selection:text-ink">
        <SmoothScroll>
          <CustomCursor />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
