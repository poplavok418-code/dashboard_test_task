import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Аналитика: загрузчик данных",
  description: "Браузерная проверка файлов и вставленного текста для аналитического демо.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
