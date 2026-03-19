import "./globals.css";
import { Inter } from "next/font/google";
import Providers from "./providers";
import ClientProvider from "@/app/components/ClientProvider"; // 🔥 əlavə olundu

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Cahan Flow",
  description: "Task management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <ClientProvider> {/* 🔥 ƏN VACİB HİSSƏ */}
            {children}
          </ClientProvider>
        </Providers>
      </body>
    </html>
  );
}