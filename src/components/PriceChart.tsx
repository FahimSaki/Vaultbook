"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export type Point = {
  at: string;
  [key: string]: string | number | null;
};

export function PriceChart({ points }: { points: Point[] }) {
  const currencies = [
    ...new Set(
      points.flatMap((point) =>
        Object.keys(point)
          .filter((key) => key.startsWith("price_"))
          .map((key) => key.slice("price_".length)),
      ),
    ),
  ];

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points}>
        <XAxis dataKey="at" />
        <YAxis />
        <Tooltip />
        <Legend />

        {currencies.map((currency) => (
          <Line
            key={`price_${currency}`}
            type="stepAfter"
            dataKey={`price_${currency}`}
            name={`Price (${currency})`}
            dot={false}
            connectNulls={false}
          />
        ))}

        {currencies.map((currency) =>
          points.some((point) => point[`cost_${currency}`] != null) ? (
            <Line
              key={`cost_${currency}`}
              type="stepAfter"
              dataKey={`cost_${currency}`}
              name={`Cost (${currency})`}
              dot={false}
              strokeDasharray="4 4"
              connectNulls={false}
            />
          ) : null,
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
