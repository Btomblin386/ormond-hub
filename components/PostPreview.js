"use client";
import { useEffect, useState } from "react";

// Live post preview card — how a post will look on the chosen channel.
// Shared by the composer (right-side pane) and the calendar quick-view modal.
export default function PostPreview({ channel, options = [], brandLogo, caption, postType, usesVideo, videoUrl, coverUrl, media }) {
  const opt = options.find((o) => o.ch === channel);
  const isIG = channel === "instagram";
  const isTT = channel === "tiktok";
  const rawHandle = opt?.label || (isIG ? "instagram" : isTT ? "tiktok" : "Facebook Page");
  const handle = rawHandle.replace(/^@/, "");
  const showVideo = usesVideo && !!videoUrl;
  const imgs = Array.isArray(media) ? media : [];
  // Render feed images at their TRUE aspect ratio (clamped to IG's 4:5–1.91:1
  // feed limits) — a fixed square box silently mis-crops the preview, which is
  // exactly what a preview must never do.
  const [natRatio, setNatRatio] = useState(null);
  useEffect(() => { setNatRatio(null); }, [imgs[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  const tall = showVideo || postType === "reel" || postType === "story";
  const feedRatio = !tall && natRatio ? Math.min(1.91, Math.max(0.8, natRatio)) : null;
  const TRUNC = 125;
  const text = caption || "";
  const feedTrunc = !isTT && [...text].length > TRUNC ? [...text].slice(0, TRUNC).join("") : null;

  return (
    <div className={"pv-card " + channel}>
      <div className="pv-head">
        <div className="pv-avatar">{brandLogo ? <img src={brandLogo} alt="" /> : <span>{handle.slice(0, 1).toUpperCase()}</span>}</div>
        <div className="pv-name">{isIG || isTT ? handle : rawHandle}</div>
        <span className="pv-more">⋯</span>
      </div>
      <div className={"pv-media" + (tall ? " tall" : "")} style={feedRatio ? { aspectRatio: String(feedRatio) } : undefined}>
        {showVideo
          ? <video src={videoUrl} controls muted playsInline preload="metadata" poster={coverUrl || undefined} />
          : imgs.length
            ? <img src={imgs[0]} alt="" onLoad={(e) => setNatRatio(e.target.naturalWidth / e.target.naturalHeight)} />
            : <div className="pv-media-empty">Media preview</div>}
        {!showVideo && imgs.length > 1 && <span className="pv-count">1 / {imgs.length}</span>}
      </div>
      <div className="pv-body">
        <div className="pv-caption">
          {(isIG || isTT) && text && <b className="pv-user">{handle}</b>}
          {text
            ? <span className="pv-cap-text">{text}</span>
            : <span className="pv-cap-text muted">Your caption will render here — with the exact line breaks and spacing it&apos;ll post with.</span>}
        </div>
        {feedTrunc && (
          <div className="pv-feednote">
            In the feed it collapses to:<br />
            <span className="pv-feedtext">{feedTrunc}…</span> <b>more</b>
          </div>
        )}
      </div>
    </div>
  );
}
