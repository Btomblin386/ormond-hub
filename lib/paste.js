// Rich-text paste helpers. Bullets in Docs/Word are list *formatting*, so a
// plain textarea paste silently drops them. When the clipboard HTML contains
// a list, we rebuild it as caption-safe text bullets (• / ◦ / ▪, "1." for
// numbered) with the exact characters that survive on Facebook/Instagram.

const BULLETS = ["•", "◦", "▪"];

export function listHtmlToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines = [];
  const walkList = (listEl, depth) => {
    const ordered = listEl.nodeName === "OL";
    let i = 0;
    for (const li of listEl.children) {
      if (li.nodeName !== "LI") continue;
      i++;
      const clone = li.cloneNode(true);
      clone.querySelectorAll("ul,ol").forEach((x) => x.remove());
      const txt = clone.textContent.replace(/\s+/g, " ").trim();
      if (txt) lines.push("  ".repeat(depth) + (ordered ? `${i}. ` : BULLETS[Math.min(depth, 2)] + " ") + txt);
      li.querySelectorAll(":scope > ul, :scope > ol").forEach((sub) => walkList(sub, depth + 1));
    }
  };
  const walkBlock = (el) => {
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { const t = n.textContent.trim(); if (t) lines.push(t); continue; }
      if (n.nodeType !== 1) continue;
      if (n.nodeName === "UL" || n.nodeName === "OL") walkList(n, 0);
      else if (n.nodeName === "BR") lines.push("");
      else if (n.querySelector && n.querySelector("ul,ol")) walkBlock(n);
      else {
        const t = n.textContent.replace(/\s+/g, " ").trim();
        if (t) lines.push(t);
        else if (n.nodeName === "P" || n.nodeName === "DIV") lines.push("");
      }
    }
  };
  walkBlock(doc.body);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// onPaste handler for caption textareas: only intervenes when the clipboard
// actually carries list markup — every other paste stays native.
export function pasteWithBullets(e, value, setValue) {
  const html = e.clipboardData?.getData("text/html") || "";
  if (!/<(li|ul|ol)[\s>]/i.test(html)) return;
  const txt = listHtmlToText(html);
  if (!txt) return;
  e.preventDefault();
  const el = e.target;
  const s = el.selectionStart ?? value.length;
  const en = el.selectionEnd ?? value.length;
  setValue(value.slice(0, s) + txt + value.slice(en));
}
