import "../legal.css";

export const metadata = { title: "Terms of Service — Ormond Brand Consulting" };

export default function Terms() {
  return (
    <div className="legal">
      <h1>Terms of Service</h1>
      <div className="eff">Ormond Brand Consulting · OBC Content Scheduler · Effective July 14, 2026</div>

      <p>
        These Terms govern use of the OBC Content Scheduler application and the internal Ormond Hub platform
        (together, the &quot;Service&quot;), operated by Ormond Brand Consulting (&quot;OBC&quot;). The Service is a
        private, internal tool used by OBC to analyze and manage advertising for the businesses it serves.
      </p>

      <h2>Use of the Service</h2>
      <p>
        Access is limited to OBC and authorized personnel acting on behalf of the businesses OBC manages. Users agree
        to use the Service only for lawful advertising analysis and management, and in compliance with the terms and
        policies of connected platforms (including Meta and Google).
      </p>

      <h2>Advertising actions</h2>
      <p>
        The Service can create and modify advertising campaigns on connected ad accounts. All campaign creation occurs
        in a paused state and requires explicit human approval before any campaign can spend. Spend limits and audit
        logging are enforced. OBC is responsible for reviewing and approving actions taken through the Service.
      </p>

      <h2>Data</h2>
      <p>
        Handling of data accessed through the Service is described in our{" "}
        <a href="/privacy">Privacy Policy</a>. Deletion requests are handled per our{" "}
        <a href="/data-deletion">Data Deletion Instructions</a>.
      </p>

      <h2>No warranty; limitation of liability</h2>
      <p>
        The Service is provided &quot;as is,&quot; without warranties of any kind. Advertising performance figures are
        drawn from third-party platforms and may differ between sources. To the fullest extent permitted by law, OBC is
        not liable for indirect or consequential damages arising from use of the Service.
      </p>

      <h2>Changes</h2>
      <p>OBC may update these Terms; the effective date above reflects the latest version.</p>

      <h2>Contact</h2>
      <p><a href="mailto:brooks@ormondbrandconsulting.com">brooks@ormondbrandconsulting.com</a></p>

      <div className="foot">© Ormond Brand Consulting.</div>
    </div>
  );
}
