"use client";
import { useEffect, useState } from "react";

// Rendered on the landing page after a sign-in whose cookie never came back
// (?li=1). Probes whether this browser can store cookies AT ALL and names
// in-app browsers, so a screenshot of this banner fully identifies the cause.
function inAppName(ua) {
  if (/FBAN|FBAV/i.test(ua)) return "the Facebook app's built-in browser";
  if (/Instagram/i.test(ua)) return "the Instagram app's built-in browser";
  if (/GSA\//i.test(ua)) return "the Google app's built-in browser";
  if (/Line\//i.test(ua)) return "the Line app's built-in browser";
  if (/; wv\)|WebView/i.test(ua)) return "an app's built-in browser";
  return null;
}

export default function CookieDiag() {
  const [d, setD] = useState(null);
  useEffect(() => {
    let jsCookie = false;
    try {
      document.cookie = "obc_probe=1; path=/; max-age=60";
      jsCookie = document.cookie.includes("obc_probe=1");
      document.cookie = "obc_probe=; path=/; max-age=0";
    } catch { /* blocked entirely */ }
    setD({ jsCookie, ua: navigator.userAgent, app: inAppName(navigator.userAgent) });
  }, []);

  if (!d) return null;
  return (
    <div className="landing-warn">
      <b>You signed in successfully, but your browser didn&apos;t keep the login cookie</b> — so the hub can&apos;t stay signed in.
      {d.app ? (
        <div style={{ marginTop: 8 }}>You&apos;re inside <b>{d.app}</b>, which often refuses to keep login cookies. Open <b>ormond-hub.vercel.app</b> in Safari or Chrome itself and sign in there.</div>
      ) : !d.jsCookie ? (
        <div style={{ marginTop: 8 }}>A quick test says <b>this browser is blocking cookies completely</b>. On iPhone: Settings → Safari → turn OFF “Block All Cookies”. On desktop: allow cookies for this site (check privacy extensions too), then sign in again.</div>
      ) : (
        <div style={{ marginTop: 8 }}>Oddly, cookies <b>do</b> work in this browser right now — so this looks like a one-off glitch. Sign in again; if you land back here, screenshot this box.</div>
      )}
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer" }}>Technical details (for support)</summary>
        <div style={{ fontSize: 11, wordBreak: "break-all", marginTop: 4 }}>cookieTest={String(d.jsCookie)} · {d.ua}</div>
      </details>
    </div>
  );
}
