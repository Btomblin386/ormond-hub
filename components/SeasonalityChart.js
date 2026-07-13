"use client";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from "recharts";

const money = (n) => (n == null ? "" : "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }));
const COLORS = ["#c4c9d4", "#818cf8", "#4338ca"];

// data: [{ month: "Jan", "2025": 123, "2026": 456 }, ...]; years: ["2025","2026"]
export default function SeasonalityChart({ data, years }) {
  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="#f0f1f3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={money} width={64} />
          <Tooltip formatter={(v) => money(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {years.map((y, i) => (
            <Line
              key={y}
              type="monotone"
              dataKey={y}
              name={y}
              stroke={COLORS[i] || "#6366f1"}
              strokeWidth={i === years.length - 1 ? 2.5 : 2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
