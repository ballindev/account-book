"use client";

import { useEffect, useState } from "react";
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
  resolveChartYears,
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

function pickInitialYear(expenses: ExpenseRow[], years: number[]) {
  const currentYear = new Date().getFullYear();
  if (expenses.some((item) => item.date.startsWith(`${currentYear}-`))) {
    return currentYear;
  }
  return years.find((year) => year !== currentYear) ?? years[0] ?? currentYear;
}

type ExpenseChartsProps = {
  expenses: ExpenseRow[];
};

export default function ExpenseCharts({ expenses }: ExpenseChartsProps) {
  const years = resolveChartYears(expenses);
  const [selectedYear, setSelectedYear] = useState(() =>
    pickInitialYear(expenses, years),
  );

  useEffect(() => {
    if (years.length === 0) return;
    if (!years.includes(selectedYear)) {
      setSelectedYear(pickInitialYear(expenses, years));
    }
  }, [years, selectedYear, expenses]);

  const yearOptions = { year: selectedYear };
  const monthly = buildMonthlyTotals(expenses, yearOptions);
  const categories = buildCategoryTotals(expenses, yearOptions);

  const yearIndex = years.indexOf(selectedYear);
  const canGoPrev = yearIndex >= 0 && yearIndex < years.length - 1;
  const canGoNext = yearIndex > 0;

  if (expenses.length === 0) {
    return (
      <p className="rounded-2xl bg-surface px-3 py-3.5 text-center text-[13px] text-muted">
        차트로 볼 지출이 아직 없습니다
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl bg-surface px-2 py-2">
        <button
          type="button"
          onClick={() => {
            if (!canGoPrev) return;
            setSelectedYear(years[yearIndex + 1]);
          }}
          disabled={!canGoPrev}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[16px] text-muted transition-colors hover:text-foreground disabled:opacity-30"
          aria-label="이전 연도"
        >
          ‹
        </button>
        <h3 className="text-[14px] font-medium text-foreground">
          {selectedYear}년
        </h3>
        <button
          type="button"
          onClick={() => {
            if (!canGoNext) return;
            setSelectedYear(years[yearIndex - 1]);
          }}
          disabled={!canGoNext}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[16px] text-muted transition-colors hover:text-foreground disabled:opacity-30"
          aria-label="다음 연도"
        >
          ›
        </button>
      </div>

      <div className="rounded-2xl bg-surface px-3 py-3">
        <h3 className="mb-2 text-[13px] font-medium text-foreground">
          월별 총 지출
        </h3>
        {monthly.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted">
            {selectedYear}년 지출이 없습니다
          </p>
        ) : (
          <div className="h-44 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthly}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e5e5ea"
                  vertical={false}
                />
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
                    value >= 10000
                      ? `${Math.round(value / 10000)}만`
                      : `${value}`
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
                <Bar
                  dataKey="total"
                  fill="#1d1d1f"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-surface px-3 py-3">
        <h3 className="mb-2 text-[13px] font-medium text-foreground">
          카테고리별 지출
        </h3>
        {categories.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted">
            {selectedYear}년 지출이 없습니다
          </p>
        ) : (
          <>
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
                    style={{
                      backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                    }}
                  />
                  <span className="text-foreground">{item.name}</span>
                  <span className="font-mono tabular-nums">
                    {formatAmount(item.value)}원
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
