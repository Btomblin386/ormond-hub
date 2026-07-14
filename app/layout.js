import "./globals.css";

export const metadata = {
  title: "Ormond Hub",
  description: "Ad performance + reconciliation",
  // Google Search Console ownership proof (needed for OAuth branding verification).
  // Set GOOGLE_SITE_VERIFICATION in Vercel to the token from Search Console's
  // "HTML tag" method — the meta tag renders on every page, including the public landing.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
