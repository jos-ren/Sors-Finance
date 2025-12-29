import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { SidebarLayout } from "@/components/SidebarLayout";
import { ThemeProvider } from "@/components/theme-provider";
import { DatabaseProvider } from "@/components/DatabaseProvider";
import { PrivacyProvider } from "@/lib/privacy-context";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sors Finance",
  description: "Local-first budget tracking and transaction categorization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <DatabaseProvider>
            <PrivacyProvider>
              <SidebarLayout>{children}</SidebarLayout>
            </PrivacyProvider>
          </DatabaseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
