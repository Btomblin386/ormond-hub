"use client";
import { useEffect, useState } from "react";
import ContentManager from "./ContentManager";
import ContentCalendar from "./ContentCalendar";

export default function ContentBoard({ clientId, client, items, socials, editId, notes = [], teamMembers = [] }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [seedDate, setSeedDate] = useState("");

  // A day-modal "Create post" seeds the composer with that date; once the
  // composer closes, drop the seed so a later "+ New post" defaults to now+30m.
  useEffect(() => { if (!composerOpen) setSeedDate(""); }, [composerOpen]);
  const calItems = items.map((it) => ({ ...it, client }));

  function onCreateOnDate(dateValue) {
    setSeedDate(dateValue);
    setComposerOpen(true);
    document.getElementById("posts")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      <div id="posts">
        <ContentManager clientId={clientId} client={client} items={items} socials={socials}
          open={composerOpen} setOpen={setComposerOpen} seedDate={seedDate} editId={editId} />
      </div>

      <div id="calendar" className="panel">
        <h2>Calendar</h2>
        <p className="note">Scheduled and pending posts. Click a day to create a post or add a note, drag a post to reschedule, or click an item to approve.</p>
        <ContentCalendar items={calItems} notes={notes} teamMembers={teamMembers} clientId={clientId} onCreateOnDate={onCreateOnDate} title={client} />
      </div>
    </>
  );
}
