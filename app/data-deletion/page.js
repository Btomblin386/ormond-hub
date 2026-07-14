import "../legal.css";

export const metadata = { title: "Data Deletion Instructions — Ormond Brand Consulting" };

export default function DataDeletion() {
  return (
    <div className="legal">
      <h1>Data Deletion Instructions</h1>
      <div className="eff">Ormond Brand Consulting · OBC Content Scheduler · Effective July 14, 2026</div>

      <p>
        The OBC Content Scheduler application is an internal tool operated by Ormond Brand Consulting (&quot;OBC&quot;)
        to analyze and manage advertising for the businesses it serves. It stores advertising and analytics data tied
        to connected business ad accounts and analytics properties — not personal profiles of individual consumers.
      </p>

      <h2>How to request deletion</h2>
      <p>
        To have the data associated with your business, ad account, or analytics property deleted from the Service,
        email <a href="mailto:brooks@ormondbrandconsulting.com">brooks@ormondbrandconsulting.com</a> with the subject
        line <strong>&quot;Data Deletion Request&quot;</strong> and include:
      </p>
      <ul>
        <li>The business name and the ad account or analytics property involved.</li>
        <li>Your name and your relationship to the business.</li>
      </ul>

      <h2>What happens next</h2>
      <ul>
        <li>We will confirm your request and remove the associated stored data from our systems, typically within 30 days.</li>
        <li>We will also disconnect the ad account or analytics property from the Service so no further data is collected.</li>
        <li>We will send written confirmation once deletion is complete.</li>
      </ul>

      <p>
        Note: deleting data from the Service does not delete anything held by the underlying platforms (Meta, Google).
        Those must be managed directly within each platform.
      </p>

      <h2>Contact</h2>
      <p><a href="mailto:brooks@ormondbrandconsulting.com">brooks@ormondbrandconsulting.com</a></p>

      <div className="foot">© Ormond Brand Consulting.</div>
    </div>
  );
}
