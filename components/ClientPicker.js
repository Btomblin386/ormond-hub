"use client";
import { useRouter, useSearchParams } from "next/navigation";

export default function ClientPicker({ clients, current }) {
  const router = useRouter();
  const params = useSearchParams();

  const onChange = (e) => {
    const p = new URLSearchParams(Array.from(params.entries()));
    p.set("client", e.target.value);
    router.push(`/reconciliation?${p.toString()}`);
  };

  return (
    <div className="picker">
      <label htmlFor="client">Client</label>
      <select id="client" value={current} onChange={onChange}>
        {clients.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}
