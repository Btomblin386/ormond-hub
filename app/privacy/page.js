import "../legal.css";

export const metadata = { title: "Privacy Policy — Ormond Brand Consulting" };

export default function Privacy() {
  return (
    <div className="legal">
      <h1>Privacy Policy</h1>
      <div className="eff">Ormond Brand Consulting · OBC Content Scheduler · Effective July 14, 2026</div>

      <p>
        This Privacy Policy explains how Ormond Brand Consulting (&quot;OBC,&quot; &quot;we,&quot; &quot;us&quot;)
        handles information in connection with the OBC Content Scheduler application and the internal Ormond Hub
        platform (together, the &quot;Service&quot;). The Service is a private, internal tool that OBC uses to
        analyze and manage advertising for the businesses it serves.
      </p>

      <h2>Who this applies to</h2>
      <p>
        The Service is operated by OBC for OBC and its clients. It is not a consumer product and does not have public
        user accounts. It processes business advertising and analytics data on behalf of the ad accounts OBC manages.
      </p>

      <h2>Information we access</h2>
      <ul>
        <li>Advertising performance data from connected Meta (Facebook/Instagram) ad accounts — campaigns, ad sets, spend, impressions, clicks, conversions, and related metrics.</li>
        <li>Ad-account configuration needed to manage advertising — such as Page and Pixel identifiers and audience settings.</li>
        <li>Website analytics data from connected Google Analytics 4 properties — aggregate traffic and e-commerce metrics.</li>
      </ul>
      <p>We do not collect end-consumer personal profiles, and we do not use the Service to build advertising profiles of individuals.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To produce reporting, attribution comparisons, and performance insights for the businesses OBC manages.</li>
        <li>To create, review, and manage advertising campaigns on behalf of those businesses (always with human approval before anything spends).</li>
      </ul>

      <h2>Google user data</h2>
      <p>
        When a Google account is connected via Google Sign-In, the Service requests read-only access to Google
        Analytics (<code>analytics.readonly</code>) and Google Ads (<code>adwords</code>) data, plus the connecting
        account&apos;s email address to label the connection. We use this data solely to provide reporting,
        attribution reconciliation, and advertising insights inside the Service for the business that owns it.
        We do not sell Google user data, do not use it for advertising targeting of individuals, and do not
        transfer it except to the service providers listed below as needed to operate the Service. Aggregate
        metrics (never credentials) may be processed by our AI provider to generate written insights. Our use and
        transfer of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>, including the Limited Use requirements. Access can be revoked at any time from your{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">Google Account permissions</a>{" "}
        page, and stored Google data is deleted on request (see below).
      </p>

      <h2>Sharing and processors</h2>
      <p>We do not sell data. We use a small number of service providers to operate the Service:</p>
      <ul>
        <li><strong>Supabase</strong> — secure database and hosting of the stored metrics.</li>
        <li><strong>Vercel</strong> — application hosting.</li>
        <li><strong>Anthropic</strong> — AI processing to generate written insights and recommendations from the metrics.</li>
        <li><strong>Meta</strong> and <strong>Google</strong> — the advertising and analytics platforms the data originates from.</li>
      </ul>

      <h2>Retention &amp; security</h2>
      <p>
        Data is retained only as long as needed to provide reporting and management for the relevant business, and is
        deleted on request (see below). Access is restricted, transmitted over encrypted connections, and protected by
        authentication.
      </p>

      <h2>Your choices</h2>
      <p>
        A managed business may disconnect its ad account or analytics property at any time, and may request access to,
        correction of, or deletion of its data. See our <a href="/data-deletion">Data Deletion Instructions</a>.
      </p>

      <h2>Contact</h2>
      <p>Questions about this policy: <a href="mailto:brooks@ormondbrandconsulting.com">brooks@ormondbrandconsulting.com</a>.</p>

      <div className="foot">© Ormond Brand Consulting. This policy may be updated; the effective date above reflects the latest version.</div>
    </div>
  );
}
