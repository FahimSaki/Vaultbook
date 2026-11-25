"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type Point = { at: string; price?: number; cost?: number };

export function PriceChart({ points }: { points: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points}>
        <XAxis dataKey="at" />
        <YAxis />
        <Tooltip />
        <Line type="stepAfter" dataKey="price" dot={false} connectNulls />
        {points.some((p) => p.cost != null) ? (
          <Line
            type="stepAfter"
            dataKey="cost"
            dot={false}
            strokeDasharray="4 4"
            connectNulls
          />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}
