"use client";
import { useEffect, useRef, useState } from "react";

// Canvas image editor for the composer: crop (drag to position + zoom) with a
// live preview, ratio presets, filters, brand-logo watermark, and a fit mode
// that pads with a color or blurred backdrop. Exports up to 1080px-wide JPEG
// (Instagram's feed width) with high-quality resampling; never upscales.
const RATIOS = [["orig", "Original"], ["1:1", "1:1"], ["4:5", "4:5"], ["1.91:1", "1.91:1"], ["9:16", "9:16"]];
const RATIO_VAL = { "1:1": 1, "4:5": 4 / 5, "1.91:1": 1.91, "9:16": 9 / 16 };
const FILTERS = [
  ["none", "None", ""],
  ["bw", "B&W", "grayscale(1) contrast(1.05)"],
  ["warm", "Warm", "sepia(.28) saturate(1.25) brightness(1.03)"],
  ["cool", "Cool", "saturate(1.1) hue-rotate(12deg) brightness(1.02)"],
  ["punch", "Punch", "contrast(1.22) saturate(1.28)"],
  ["fade", "Fade", "brightness(1.06) contrast(.88) saturate(.8)"],
];
const CORNERS = [["br", "Bottom right"], ["bl", "Bottom left"], ["tr", "Top right"], ["tl", "Top left"]];

function loadImg(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Couldn't load the image for editing."));
    im.src = url;
  });
}

export default function ImageEditor({ src, brandLogo, onApply, onClose }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const logoRef = useRef(null);
  const dragRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [ratio, setRatio] = useState("orig");
  const [mode, setMode] = useState("cover"); // cover = crop · fit = pad
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0.5, y: 0.5 }); // focal point 0..1
  const [filter, setFilter] = useState("none");
  const [wm, setWm] = useState(false);
  const [wmCorner, setWmCorner] = useState("br");
  const [bgKind, setBgKind] = useState("blur"); // fit mode: blur | color
  const [bgColor, setBgColor] = useState("#111827");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        imgRef.current = await loadImg(src);
        if (brandLogo) { try { logoRef.current = await loadImg(brandLogo); } catch { /* watermark optional */ } }
        if (!cancel) setReady(true);
      } catch (e) { if (!cancel) setErr(String(e.message || e)); }
    })();
    return () => { cancel = true; };
  }, [src, brandLogo]);

  function render(canvas, outW) {
    const img = imgRef.current; if (!img || !canvas) return;
    const r = ratio === "orig" ? img.width / img.height : RATIO_VAL[ratio];
    const W = outW, H = Math.round(outW / r);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    // High-quality resampling — matters most on the 1080px export downscale.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const filt = FILTERS.find((f) => f[0] === filter)?.[2] || "";

    if (mode === "fit" && ratio !== "orig") {
      // background
      if (bgKind === "color") { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, W, H); }
      else {
        const s = Math.max(W / img.width, H / img.height) * 1.1;
        ctx.save(); ctx.filter = "blur(28px) brightness(.92)";
        ctx.drawImage(img, W / 2 - (img.width * s) / 2, H / 2 - (img.height * s) / 2, img.width * s, img.height * s);
        ctx.restore();
      }
      const s = Math.min(W / img.width, H / img.height) * Math.min(zoom, 1);
      const w = img.width * s, h = img.height * s;
      ctx.save(); if (filt) ctx.filter = filt;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      ctx.restore();
    } else {
      // cover: fill the frame, focal point + zoom decide the crop window
      const base = Math.max(W / img.width, H / img.height);
      const s = base * zoom;
      const w = img.width * s, h = img.height * s;
      const maxX = Math.max(0, w - W), maxY = Math.max(0, h - H);
      const x = -off.x * maxX, y = -off.y * maxY;
      ctx.save(); if (filt) ctx.filter = filt;
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
    }

    if (wm && logoRef.current) {
      const lg = logoRef.current;
      const lw = Math.round(W * 0.14), lh = Math.round(lg.height * (lw / lg.width));
      const pad = Math.round(W * 0.03);
      const pos = {
        br: [W - lw - pad, H - lh - pad], bl: [pad, H - lh - pad],
        tr: [W - lw - pad, pad], tl: [pad, pad],
      }[wmCorner];
      ctx.save(); ctx.globalAlpha = 0.9; ctx.drawImage(lg, pos[0], pos[1], lw, lh); ctx.restore();
    }
  }

  // live preview
  useEffect(() => { if (ready) render(canvasRef.current, 520); });

  function onPointerDown(e) {
    if (mode !== "cover") return;
    dragRef.current = { x: e.clientX, y: e.clientY, off: { ...off } };
  }
  function onPointerMove(e) {
    const d = dragRef.current; if (!d) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setOff({
      x: Math.min(1, Math.max(0, d.off.x - (e.clientX - d.x) / rect.width)),
      y: Math.min(1, Math.max(0, d.off.y - (e.clientY - d.y) / rect.height)),
    });
  }
  const onPointerUp = () => { dragRef.current = null; };

  async function apply() {
    setBusy(true);
    try {
      const out = document.createElement("canvas");
      // Export at 1080px wide (Instagram's feed display width), but never upscale
      // a smaller source — manufacturing pixels only softens it. Fit mode pads to
      // a full 1080 canvas (the padding is synthetic, so it's fine).
      const img = imgRef.current;
      const outW = mode === "fit" ? 1080 : Math.min(1080, img?.width || 1080);
      render(out, outW);
      onApply(out.toDataURL("image/jpeg", 0.95));
      onClose();
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }

  return (
    <div className="cal-modal" onClick={onClose}>
      <div className="cal-modal-inner day-modal editor-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cal-x day-x" onClick={onClose}>×</button>
        <h3 className="day-title">Edit image</h3>
        {err && <div className="push-err">{err}</div>}
        {!ready && !err && <div className="muted" style={{ fontSize: 13 }}>Loading…</div>}
        {ready && (
          <div className="editor-body">
            <div className="editor-stage">
              <canvas ref={canvasRef} className="editor-canvas"
                onPointerDown={onPointerDown} onPointerMove={onPointerMove}
                onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
                style={{ cursor: mode === "cover" ? "grab" : "default", touchAction: "none" }} />
              {mode === "cover" && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Drag the image to reframe · zoom below</div>}
            </div>
            <div className="editor-controls">
              <div className="ed-group">
                <label>Ratio</label>
                <div className="ed-chips">{RATIOS.map(([k, l]) => <button key={k} className={"ed-chip" + (ratio === k ? " on" : "")} onClick={() => { setRatio(k); setOff({ x: 0.5, y: 0.5 }); }}>{l}</button>)}</div>
              </div>
              {ratio !== "orig" && (
                <div className="ed-group">
                  <label>Frame</label>
                  <div className="ed-chips">
                    <button className={"ed-chip" + (mode === "cover" ? " on" : "")} onClick={() => setMode("cover")}>Crop to fill</button>
                    <button className={"ed-chip" + (mode === "fit" ? " on" : "")} onClick={() => setMode("fit")}>Fit + background</button>
                  </div>
                </div>
              )}
              {mode === "fit" && ratio !== "orig" && (
                <div className="ed-group">
                  <label>Background</label>
                  <div className="ed-chips">
                    <button className={"ed-chip" + (bgKind === "blur" ? " on" : "")} onClick={() => setBgKind("blur")}>Blurred image</button>
                    <button className={"ed-chip" + (bgKind === "color" ? " on" : "")} onClick={() => setBgKind("color")}>Color</button>
                    {bgKind === "color" && <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />}
                  </div>
                </div>
              )}
              <div className="ed-group">
                <label>Zoom</label>
                <input type="range" min="1" max="2.5" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: "100%" }} />
              </div>
              <div className="ed-group">
                <label>Filter</label>
                <div className="ed-chips">{FILTERS.map(([k, l]) => <button key={k} className={"ed-chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>{l}</button>)}</div>
              </div>
              <div className="ed-group">
                <label>Watermark {brandLogo ? "" : <span className="muted" style={{ fontWeight: 400 }}>(upload a logo in the brand kit first)</span>}</label>
                <div className="ed-chips">
                  <button className={"ed-chip" + (wm ? " on" : "")} disabled={!logoRef.current} onClick={() => setWm((w) => !w)}>{wm ? "✓ Logo on" : "Add logo"}</button>
                  {wm && CORNERS.map(([k, l]) => <button key={k} className={"ed-chip" + (wmCorner === k ? " on" : "")} onClick={() => setWmCorner(k)}>{l}</button>)}
                </div>
              </div>
              <div className="cal-modal-actions" style={{ marginTop: 6 }}>
                <button className="cal-approve" disabled={busy} onClick={apply}>{busy ? "Applying…" : "Apply"}</button>
                <button className="cal-reject" onClick={onClose}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
