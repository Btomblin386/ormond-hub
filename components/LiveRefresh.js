"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Keeps server-fetched data fresh without interrupting anyone's flow.
//
// Why polling + router.refresh() (and not websockets/realtime): every mutation
// in this app already calls router.refresh(), which re-renders the SERVER
// components with fresh DB data while React preserves all CLIENT component
// state — open modals, checkbox selections, half-typed drafts all survive. So
// a background refresh is exactly as safe as the refresh that already happens
// after every save. Realtime push would add a public subscription surface and
// new infra for an app with a handful of concurrent users; a 45s poll costs
// one cheap query round and arrives well within a "Brie just posted" window.
//
// Guardrails so it never disturbs work in progress:
//  - paused prop: parent sets it while the composer/editor is open
//  - skipped while the tab is hidden (refreshes the moment you come back)
//  - skipped mid drag-and-drop (a re-render can abort a native HTML5 drag)
//  - rate-limited so focus/visibility events can't stack refreshes
export default function LiveRefresh({ paused = false, intervalMs = 45000 }) {
  const router = useRouter();
  const last = useRef(Date.now());
  const dragging = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const maybe = (minGap) => {
      if (pausedRef.current || dragging.current) return;
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last.current < minGap) return;
      last.current = Date.now();
      router.refresh();
    };
    const iv = setInterval(() => maybe(intervalMs - 5000), intervalMs);
    // Coming back to the tab/window is the #1 "why is this stale" moment —
    // refresh right away (min 10s gap so alt-tabbing around doesn't spam).
    const onVis = () => maybe(10000);
    const onDragStart = () => { dragging.current = true; };
    const onDragEnd = () => { dragging.current = false; };
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragend", onDragEnd);
    document.addEventListener("drop", onDragEnd);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragend", onDragEnd);
      document.removeEventListener("drop", onDragEnd);
    };
  }, [intervalMs, router]);

  return null;
}
