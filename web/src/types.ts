import type { CapMode } from "./lib/finance";

export type Member = {
  id: string;
  name: string;
  nick: string;
  role: "owner" | "member";
};

export type IncomeSource = {
  id: string;
  name: string;
  amount: number;
  days: number[]; // day-of-month
  memberId?: string;
};

export type ObligationKind = "bill" | "subscription" | "debt" | "sinking";

export type Obligation = {
  id: string;
  name: string;
  kind: ObligationKind;
  amount: number;
  dueDay: number;
  frequency: "monthly" | "yearly" | "quarterly";
  // debt
  balance?: number;
  annualRate?: number;
  // sinking
  targetAmount?: number;
  savedAmount?: number;
  assignMode?: "auto" | "pin";
  pinnedPayDay?: number;
};

export type Tx = {
  id: string;
  at: string; // ISO
  title: string;
  amount: number; // signed: +income / -spend
  memberId: string;
  kind: "income" | "spend" | "reserve" | "transfer" | "debt_pay";
};

export type Household = {
  id: string;
  inviteSlug: string;
  members: Member[];
  cashOnHand: number;
  savingsBalance: number;
  savingsRate: number;
  savingsCap: CapMode;
  savingsGoal: number;
  incomes: IncomeSource[];
  obligations: Obligation[];
  transactions: Tx[];
};

export type SessionUser = {
  id: string;
  name: string;
  nick: string;
  email: string;
};
