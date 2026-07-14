"use client";

// Instagram-safe aspect ratios (width / height)
export const IG_RATIOS = {
  "1:1": 1,
  "4:5": 0.8,       // portrait feed
  "1.91:1": 1.91,   // landscape feed
  "9:16": 0.5625,   // story / reel
};
export const IG_FEED_MIN = 0.8, IG_FEED_MAX = 1.91;

export function fileToB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function imageSize(dataUrl) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight, ratio: im.naturalWidth / im.naturalHeight });
    im.onerror = rej;
    im.src = dataUrl;
  });
}

// Center-crop a data URL to a target ratio (w/h). Returns a JPEG data URL.
export function cropToRatio(dataUrl, ratio) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      const cur = im.naturalWidth / im.naturalHeight;
      let sw = im.naturalWidth, sh = im.naturalHeight, sx = 0, sy = 0;
      if (cur > ratio) { sw = Math.round(im.naturalHeight * ratio); sx = Math.round((im.naturalWidth - sw) / 2); }
      else { sh = Math.round(im.naturalWidth / ratio); sy = Math.round((im.naturalHeight - sh) / 2); }
      const c = document.createElement("canvas");
      c.width = sw; c.height = sh;
      c.getContext("2d").drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
      res(c.toDataURL("image/jpeg", 0.92));
    };
    im.onerror = rej;
    im.src = dataUrl;
  });
}

// Upload an image (base64 data URL or remote url) with progress callback.
export function uploadImage({ image_base64, image_url, filename, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/content-media");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      try { const d = JSON.parse(xhr.responseText); d.url ? resolve(d) : reject(new Error(d.error || "upload failed")); }
      catch { reject(new Error("upload failed")); }
    };
    xhr.onerror = () => reject(new Error("network error during upload"));
    xhr.send(JSON.stringify({ image_base64, image_url, filename }));
  });
}

// Read video metadata (best-effort; cross-origin may block dimensions).
export function videoMeta(url) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight, duration: v.duration, ratio: v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 0 });
    v.onerror = () => resolve(null);
    v.src = url;
  });
}

// Validate a reel video against IG limits. Returns a warning string or null.
export function validateReel(meta) {
  if (!meta || !meta.duration) return null; // couldn't read (cross-origin) — don't block
  const warns = [];
  if (meta.duration > 90) warns.push(`${Math.round(meta.duration)}s is over Instagram's 90s Reel limit`);
  if (meta.width && meta.width < 540) warns.push(`${meta.width}px wide is below the 540px minimum (1080px recommended)`);
  if (meta.ratio && (meta.ratio < 0.5 || meta.ratio > 0.65)) warns.push("aspect isn't close to 9:16 — Instagram may crop it");
  return warns.length ? warns.join("; ") : null;
}
