"use client";
import { useState } from "react";
import BrandListener from "./BrandListener";
import RepurposeStudio from "./RepurposeStudio";

export default function EngageBoard({ clientId, client, mentions, sources, brand }) {
  const [seed, setSeed] = useState("");
  const [seedImage, setSeedImage] = useState("");

  function onRepurpose(payload) {
    const text = typeof payload === "string" ? payload : (payload?.text || "");
    const image = typeof payload === "string" ? "" : (payload?.image || "");
    setSeed(text);
    setSeedImage(image);
    document.getElementById("repurpose")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      <BrandListener clientId={clientId} sources={sources} mentions={mentions} onRepurpose={onRepurpose} />
      <RepurposeStudio clientId={clientId} client={client} brand={brand} seed={seed} seedImage={seedImage} />
    </>
  );
}
