import "./globals.css";

export const metadata = {
  title: "Ormond Hub",
  description: "Ad performance + reconciliation",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
