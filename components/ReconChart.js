"use client";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from "recharts";

const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function ReconChart({ data }) {
  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="#f0f1f3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={28} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={money} width={64} />
          <Tooltip formatter={(v) => money(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="store" name="Store revenue (GA4)" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="claim" name="Meta claims" stroke="#6366f1" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="paid" name="Meta last-click (GA4)" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
