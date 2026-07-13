export const money = (n) =>
  "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
export const money2 = (n) =>
  "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (n) => Number(n || 0).toLocaleString();
export const pct = (n) => Math.round(Number(n || 0) * 100) + "%";
export const roasClass = (r) => (r >= 4 ? "roas-good" : r >= 1.5 ? "roas-mid" : "roas-low");
export const roas = (rev, spend) => (spend > 0 ? rev / spend : 0);
