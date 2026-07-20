"use client";
import { Fragment, useState } from "react";

// Credentials live in Supabase Edge Function secrets and Vercel env vars, not in
// the app database — so this panel shows status and, on click, exactly where and
// how to update each one. (A self-serve in-app editor comes with multi-tenant.)
export default function CredentialsPanel({ creds, status }) {
  const [open, setOpen] = useState(null);
  return (
    <table className="cred-table">
      <thead><tr><th></th><th>Credential</th><th>Powers</th><th></th></tr></thead>
      <tbody>
        {creds.map(([key, label, where, powers, how]) => (
          <Fragment key={key}>
            <tr>
              <td>{status[key] === true ? <span className="social-ok">✓</span> : status[key] === false ? <span className="cred-missing">✗</span> : <span className="muted">?</span>}</td>
              <td><b>{label}</b><div className="muted" style={{ fontSize: 11 }}>{key}</div></td>
              <td style={{ fontSize: 12.5 }}>{powers}</td>
              <td><button className="social-btn" onClick={() => setOpen(open === key ? null : key)}>{open === key ? "Hide" : "How to update"}</button></td>
            </tr>
            {open === key && (
              <tr className="cred-how-row">
                <td></td>
                <td colSpan={3}>
                  <div className="cred-how">
                    <div><b>Lives in:</b> {where}</div>
                    <ol>{how.map((step, i) => <li key={i}>{step}</li>)}</ol>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
