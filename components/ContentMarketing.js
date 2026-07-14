"use client";
import { useRef, useState } from "react";
import ContentManager from "./ContentManager";
import ContentCalendar from "./ContentCalendar";
import BrandListener from "./BrandListener";
import RepurposeStudio from "./RepurposeStudio";

export default function ContentMarketing({ clientId, client, items, social, mentions, sources, brand }) {
  const [seed, setSeed] = useState("");
  const repurposeRef = useRef(null);

  const calItems = items.map((it) => ({ ...it, client }));

  function onRepurpose(textFromMention) {
    setSeed(textFromMention);
    document.getElementById("repurpose")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      <div id="posts">
        <ContentManager clientId={clientId} client={client} items={items} social={social} />
      </div>

      <div id="calendar" className="panel">
        <h2>Calendar</h2>
        <p className="note">This account&apos;s scheduled and pending posts. Click any item to approve or send back.</p>
        <ContentCalendar items={calItems} />
      </div>

      <BrandListener clientId={clientId} sources={sources} mentions={mentions} onRepurpose={onRepurpose} />

      <div ref={repurposeRef}>
        <RepurposeStudio clientId={clientId} client={client} brand={brand} seed={seed} />
      </div>
    </>
  );
}
