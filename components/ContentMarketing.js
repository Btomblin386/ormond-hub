"use client";
import { useRef, useState } from "react";
import ContentManager from "./ContentManager";
import ContentCalendar from "./ContentCalendar";
import BrandListener from "./BrandListener";
import RepurposeStudio from "./RepurposeStudio";

export default function ContentMarketing({ clientId, client, items, social, mentions, sources, brand }) {
  const [seed, setSeed] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [seedDate, setSeedDate] = useState("");
  const repurposeRef = useRef(null);

  const calItems = items.map((it) => ({ ...it, client }));

  function onRepurpose(textFromMention) {
    setSeed(textFromMention);
    document.getElementById("repurpose")?.scrollIntoView({ behavior: "smooth" });
  }
  function onCreateOnDate(dateValue) {
    setSeedDate(dateValue);
    setComposerOpen(true);
    document.getElementById("posts")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      <div id="posts">
        <ContentManager clientId={clientId} client={client} items={items} social={social}
          open={composerOpen} setOpen={setComposerOpen} seedDate={seedDate} />
      </div>

      <div id="calendar" className="panel">
        <h2>Calendar</h2>
        <p className="note">This account&apos;s scheduled and pending posts. Drag a post to reschedule it, right-click a day to create one, or click an item to approve.</p>
        <ContentCalendar items={calItems} onCreateOnDate={onCreateOnDate} />
      </div>

      <BrandListener clientId={clientId} sources={sources} mentions={mentions} onRepurpose={onRepurpose} />

      <div ref={repurposeRef}>
        <RepurposeStudio clientId={clientId} client={client} brand={brand} seed={seed} />
      </div>
    </>
  );
}
