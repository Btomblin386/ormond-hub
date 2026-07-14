"use client";
import { useState } from "react";
import ContentManager from "./ContentManager";
import ContentCalendar from "./ContentCalendar";

export default function ContentBoard({ clientId, client, items, social }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [seedDate, setSeedDate] = useState("");
  const calItems = items.map((it) => ({ ...it, client }));

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
        <p className="note">Scheduled and pending posts. Drag a post to reschedule, right-click a day to create one, or click an item to approve.</p>
        <ContentCalendar items={calItems} onCreateOnDate={onCreateOnDate} title={client} />
      </div>
    </>
  );
}
