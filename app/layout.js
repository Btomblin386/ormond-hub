import "./globals.css";

export const metadata = {
  title: "Ormond Hub",
  description: "Ad performance + reconciliation",
  // Domain-ownership proofs, rendered as <meta> tags on every page (incl. the
  // public landing). Google: Search Console "HTML tag" token. TikTok: the value
  // from the developer portal's "Verify meta tag" method. Set each in Vercel.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.TIKTOK_SITE_VERIFICATION
      ? { "tiktok-developers-site-verification": process.env.TIKTOK_SITE_VERIFICATION }
      : undefined,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
