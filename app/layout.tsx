import "./globals.css";
import { Inter } from "next/font/google";
import Providers from "./providers";
import ClientProvider from "@/app/components/ClientProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-inter",
});

export const metadata = {
  title: "Cahan Flow",
  description: "Task management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="az" className={inter.variable}>
      <body>
        <Providers>
          <ClientProvider>{children}</ClientProvider>
        </Providers>
      </body>
    </html>
  );
}