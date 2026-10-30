export type CapMode = "m" | "q" | "y";

/** Future value of a deposit with periodic compounding. */
export function depositFuture(
  principal: number,
  annualPct: number,
  months: number,
  mode: CapMode = "m",
): number {
  const r = annualPct / 100;
  const m = mode === "m" ? 12 : mode === "q" ? 4 : 1;
  const periods = (months / 12) * m;
  const rate = r / m;
  if (rate === 0) return principal;
  return principal * Math.pow(1 + rate, periods);
}

export type LoanPlan = {
  months: number | null;
  interestTotal: number | null;
  payoffDate: Date | null;
};

/** Amortize a loan with fixed monthly payment; returns months and interest. */
export function loanSchedule(
  balance: number,
  annualPct: number,
  payment: number,
  from: Date = new Date(),
): LoanPlan {
  const monthlyRate = annualPct / 100 / 12;
  let bal = balance;
  let months = 0;
  let interestTotal = 0;
  const guard = 600;

  if (payment <= 0 || balance <= 0) {
    return { months: null, interestTotal: null, payoffDate: null };
  }

  while (bal > 0.5 && months < guard) {
    const interest = bal * monthlyRate;
    interestTotal += interest;
    const principal = payment - interest;
    if (principal <= 0) {
      return { months: null, interestTotal: null, payoffDate: null };
    }
    bal -= principal;
    months += 1;
  }

  const payoffDate = new Date(from);
  payoffDate.setMonth(payoffDate.getMonth() + months);
  return { months, interestTotal, payoffDate };
}

/**
 * Pick the paycheck date that should reserve an obligation:
 * the last income on or before the due date.
 */
export function nearestPaycheckBefore(
  dueDay: number,
  incomeDays: number[],
  _year?: number,
  _month?: number,
): number | null {
  const sorted = [...incomeDays].sort((a, b) => a - b);
  const before = sorted.filter((d) => d <= dueDay);
  if (before.length) return before[before.length - 1];
  // wrap: use last income of previous month conceptually
  return sorted.length ? sorted[sorted.length - 1] : null;
}

export type Period = {
  start: Date;
  end: Date; // inclusive day before next income
  incomeAmount: number;
  paycheckDay: number;
};

/** Build pay periods from sorted unique paycheck days in a month window. */
export function buildPeriodsAround(
  today: Date,
  paycheckDays: { day: number; amount: number }[],
): Period | null {
  if (!paycheckDays.length) return null;
  const days = [...paycheckDays].sort((a, b) => a.day - b.day);
  const y = today.getFullYear();
  const m = today.getMonth();
  const dayNum = today.getDate();
  const todayStart = new Date(y, m, dayNum).getTime();

  // Find current period: last paycheck on or before today → next paycheck
  const thisMonth = days.map((p) => ({ ...p, date: new Date(y, m, p.day) }));
  const prevMonth = days.map((p) => ({
    ...p,
    date: new Date(y, m - 1, p.day),
  }));
  const nextMonth = days.map((p) => ({
    ...p,
    date: new Date(y, m + 1, p.day),
  }));
  const all = [...prevMonth, ...thisMonth, ...nextMonth].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  let startIdx = -1;
  for (let i = 0; i < all.length; i++) {
    if (all[i].date.getTime() <= todayStart) startIdx = i;
  }

  if (startIdx < 0 || startIdx >= all.length - 1) {
    // fallback: first period of this month
    const start = thisMonth[0];
    const endPay = thisMonth[1] ?? nextMonth[0];
    const end = new Date(endPay.date);
    end.setDate(end.getDate() - 1);
    return {
      start: start.date,
      end,
      incomeAmount: start.amount,
      paycheckDay: start.day,
    };
  }

  const start = all[startIdx];
  const next = all[startIdx + 1];
  const end = new Date(next.date);
  end.setDate(end.getDate() - 1);
  return {
    start: start.date,
    end,
    incomeAmount: start.amount,
    paycheckDay: start.day,
  };
}

export function daysLeft(end: Date, today: Date = new Date()): number {
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

export type PeriodSummary = {
  total: number;
  obligatory: number;
  free: number;
  hints: string[];
};

export function summarizePeriod(opts: {
  periodIncome: number;
  cashOnHand: number;
  reservedObligations: { name: string; amount: number; dueDay: number; assignedPayDay: number | null }[];
  spentInPeriod: number;
  sinkingThisPeriod: number;
}): PeriodSummary {
  // "Всего" for the period view: this paycheck amount (planning unit)
  const total = opts.periodIncome;
  const obligatory =
    opts.reservedObligations.reduce((s, o) => s + o.amount, 0) +
    opts.sinkingThisPeriod;
  const free = total - obligatory - opts.spentInPeriod;
  const hints = opts.reservedObligations.map(
    (o) =>
      `${o.name} ${Math.round(o.amount)} руб. к ${o.dueDay}-му берется из зарплаты ${o.assignedPayDay}-го`,
  );
  return { total, obligatory, free, hints };
}
