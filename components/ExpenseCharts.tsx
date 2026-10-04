"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExpenseRow } from "../lib/supabase";
import {
  buildCategoryTotals,
  buildMonthlyTotals,
} from "../lib/expense-stats";

const PIE_COLORS = [
  "#1d1d1f",
  "#007aff",
  "#ff9500",
  "#34c759",
  "#64d2ff",
  "#8e8e93",
];

function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

type ExpenseChartsProps = {
  expenses: ExpenseRow[];
};

export default function ExpenseCharts({ expenses }: ExpenseChartsProps) {
  const monthly = buildMonthlyTotals(expenses);
  const categories = buildCategoryTotals(expenses);

  if (expenses.length === 0) {
    return (
      <p className="rounded-2xl bg-surface px-3 py-3.5 text-center text-[13px] text-muted">
        차트로 볼 지출이 아직 없습니다
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-surface px-3 py-3">
        <h3 className="mb-2 text-[13px] font-medium text-foreground">
          월별 총 지출
        </h3>
        <div className="h-44 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#8e8e93" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#8e8e93" }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(value: number) =>
                  value >= 10000 ? `${Math.round(value / 10000)}만` : `${value}`
                }
              />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                formatter={(value) => [
                  `${formatAmount(Number(value ?? 0))}원`,
                  "총 지출",
                ]}
                contentStyle={{
                  borderRadius: 12,
                  border: "none",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="total" fill="#1d1d1f" radius={[8, 8, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl bg-surface px-3 py-3">
        <h3 className="mb-2 text-[13px] font-medium text-foreground">
          카테고리별 지출
        </h3>
        <div className="h-48 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categories}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={68}
                paddingAngle={2}
              >
                {categories.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${formatAmount(Number(value ?? 0))}원`,
                  String(name),
                ]}
                contentStyle={{
                  borderRadius: 12,
                  border: "none",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5 px-1">
          {categories.map((item, index) => (
            <li
              key={item.name}
              className="flex items-center gap-1.5 text-[12px] text-muted"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
              />
              <span className="text-foreground">{item.name}</span>
              <span className="font-mono tabular-nums">
                {formatAmount(item.value)}원
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
