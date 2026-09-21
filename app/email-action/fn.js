// content-alerts edge function + the project's anon JWT (public by design — it's
// in the app bundle and crons). Shared by the /email-action page and its approve route.
// CONTENT_ALERTS_FN is only set when verifying locally against a stand-in function.
export const FN = process.env.CONTENT_ALERTS_FN || "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/content-alerts";
export const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";
