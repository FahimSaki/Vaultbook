"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatMoney } from "@/lib/money";

export type Point = { at: string; price?: number; cost?: number };

export function PriceChart({
  points,
  currency,
}: {
  points: Point[];
  currency: string;
}) {
  const fmt = (v: unknown) =>
    formatMoney(Math.round(Number(v) * 100), currency);
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">
        Amounts in {currency}. Points recorded before a currency change keep
        their old numbers.
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={points}>
          <XAxis dataKey="at" />
          <YAxis width={70} />
          <Tooltip formatter={(v) => fmt(v)} />
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
    </div>
  );
}
