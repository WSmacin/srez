import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { demoHousehold, demoUser, DEMO_PASSWORD } from "../data/demo";
import {
  buildPeriodsAround,
  daysLeft,
  depositFuture,
  loanSchedule,
  nearestPaycheckBefore,
  summarizePeriod,
  type CapMode,
} from "../lib/finance";
import type { Household, Obligation, SessionUser, Tx } from "../types";

const STORAGE_KEY = "srez-v1";
const USERS_KEY = "srez-users";

type StoredUser = SessionUser & { password: string };

type Persisted = {
  user: SessionUser | null;
  household: Household;
};

type BudgetContextValue = {
  user: SessionUser | null;
  household: Household;
  login: (id: string, password: string) => { ok: true } | { ok: false; error: string };
  register: (
    nick: string,
    email: string,
    password: string,
    name: string,
  ) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  updateCash: (n: number) => void;
  updateSavings: (balance: number, rate: number, cap: CapMode, goal?: number) => void;
  updateDebt: (id: string, patch: Partial<Obligation>) => void;
  addSpend: (title: string, amount: number) => void;
  markDebtPayment: (id: string) => void;
  inviteByNick: (nick: string) => { ok: true; message: string } | { ok: false; error: string };
  periodView: ReturnType<typeof usePeriodView>;
};

function usePeriodView(hh: Household) {
  return useMemo(() => {
    const today = new Date();
    const primary = hh.incomes.find((i) => i.days.length >= 2) ?? hh.incomes[0];
    const periodSource = primary
      ? primary.days.map((day) => ({ day, amount: primary.amount }))
      : [];
    const period = buildPeriodsAround(today, periodSource);

    const uniqueDays = [
      ...new Set(hh.incomes.flatMap((inc) => inc.days)),
    ].sort((a, b) => a - b);

    const reserved = hh.obligations
      .filter((o) => o.kind === "debt" || o.kind === "bill" || o.kind === "subscription")
      .map((o) => {
        const assigned =
          o.assignMode === "pin" && o.pinnedPayDay
            ? o.pinnedPayDay
            : nearestPaycheckBefore(
                o.dueDay,
                uniqueDays,
                today.getFullYear(),
                today.getMonth(),
              );
        return { ...o, assignedPayDay: assigned };
      })
      .filter((o) => period && o.assignedPayDay === period.paycheckDay);

    const sinking = hh.obligations
      .filter((o) => o.kind === "sinking")
      .reduce((s, o) => s + o.amount, 0);

    const spentInPeriod = hh.transactions
      .filter((t) => {
        if (!period || t.kind !== "spend") return false;
        const at = new Date(t.at);
        const end = new Date(
          period.end.getFullYear(),
          period.end.getMonth(),
          period.end.getDate(),
          23,
          59,
        );
        return at >= period.start && at <= end;
      })
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const summary = period
      ? summarizePeriod({
          periodIncome: period.incomeAmount,
          cashOnHand: hh.cashOnHand,
          reservedObligations: reserved.map((r) => ({
            name: r.name,
            amount: r.amount,
            dueDay: r.dueDay,
            assignedPayDay: r.assignedPayDay,
          })),
          spentInPeriod,
          sinkingThisPeriod: sinking,
        })
      : { total: 0, obligatory: 0, free: 0, hints: [] as string[] };

    const debt = hh.obligations.find((o) => o.kind === "debt");
    const loan =
      debt && debt.balance != null && debt.annualRate != null
        ? loanSchedule(debt.balance, debt.annualRate, debt.amount)
        : null;

    const savingsYear = depositFuture(
      hh.savingsBalance,
      hh.savingsRate,
      12,
      hh.savingsCap,
    );

    return {
      period,
      daysLeft: period ? daysLeft(period.end, today) : 0,
      summary,
      reserved,
      sinking,
      spentInPeriod,
      loan,
      savingsYear,
      savingsIncome: savingsYear - hh.savingsBalance,
    };
  }, [hh]);
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Persisted;
  } catch {
    /* ignore */
  }
  return { user: null, household: structuredClone(demoHousehold) };
}

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw) as StoredUser[];
  } catch {
    /* ignore */
  }
  return [];
}

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => load().user);
  const [household, setHousehold] = useState<Household>(() => load().household);
  const periodView = usePeriodView(household);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, household }));
  }, [user, household]);

  const login = useCallback((id: string, password: string) => {
    const key = id.trim().toLowerCase().replace(/^@/, "");
    const isDemo =
      (key === demoUser.email || key === demoUser.nick) &&
      (password === DEMO_PASSWORD || password === "demo");
    if (isDemo) {
      setUser(demoUser);
      setHousehold((h) => (h.members.length ? h : structuredClone(demoHousehold)));
      return { ok: true as const };
    }
    const found = loadUsers().find(
      (u) => u.nick === key || u.email.toLowerCase() === key,
    );
    if (!found || found.password !== password) {
      return {
        ok: false as const,
        error: "Неверный логин или пароль. Демо: anya@mail.ru / demo1234",
      };
    }
    setUser({
      id: found.id,
      name: found.name,
      nick: found.nick,
      email: found.email,
    });
    return { ok: true as const };
  }, []);

  const register = useCallback(
    (nick: string, email: string, password: string, name: string) => {
      const n = nick.replace(/^@/, "").trim().toLowerCase();
      if (n.length < 2) return { ok: false as const, error: "Укажите ник" };
      if (!email.includes("@")) return { ok: false as const, error: "Укажите почту" };
      if (password.length < 6)
        return { ok: false as const, error: "Пароль не короче 6 символов" };
      const users = loadUsers();
      if (users.some((u) => u.nick === n || u.email === email.toLowerCase())) {
        return { ok: false as const, error: "Такой ник или почта уже есть" };
      }
      const id = `u-${n}`;
      const stored: StoredUser = {
        id,
        nick: n,
        email: email.toLowerCase(),
        password,
        name: name.trim() || n,
      };
      localStorage.setItem(USERS_KEY, JSON.stringify([...users, stored]));
      setUser({
        id,
        nick: n,
        email: stored.email,
        name: stored.name,
      });
      setHousehold({
        ...structuredClone(demoHousehold),
        id: `hh-${n}`,
        inviteSlug: `${n}-budget`,
        members: [{ id, name: stored.name, nick: n, role: "owner" }],
        transactions: [],
      });
      return { ok: true as const };
    },
    [],
  );

  const logout = useCallback(() => setUser(null), []);

  const updateCash = useCallback((n: number) => {
    setHousehold((h) => ({ ...h, cashOnHand: n }));
  }, []);

  const updateSavings = useCallback(
    (balance: number, rate: number, cap: CapMode, goal?: number) => {
      setHousehold((h) => ({
        ...h,
        savingsBalance: balance,
        savingsRate: rate,
        savingsCap: cap,
        savingsGoal: goal ?? h.savingsGoal,
      }));
    },
    [],
  );

  const updateDebt = useCallback((id: string, patch: Partial<Obligation>) => {
    setHousehold((h) => ({
      ...h,
      obligations: h.obligations.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }, []);

  const addSpend = useCallback(
    (title: string, amount: number) => {
      if (!user) return;
      const tx: Tx = {
        id: `tx-${Date.now()}`,
        at: new Date().toISOString(),
        title,
        amount: -Math.abs(amount),
        memberId: user.id,
        kind: "spend",
      };
      setHousehold((h) => ({
        ...h,
        cashOnHand: Math.max(0, h.cashOnHand - Math.abs(amount)),
        transactions: [tx, ...h.transactions],
      }));
    },
    [user],
  );

  const markDebtPayment = useCallback(
    (id: string) => {
      setHousehold((h) => {
        const ob = h.obligations.find((o) => o.id === id);
        if (!ob || ob.balance == null) return h;
        const pay = ob.amount;
        const tx: Tx = {
          id: `tx-${Date.now()}`,
          at: new Date().toISOString(),
          title: `Платеж · ${ob.name}`,
          amount: -pay,
          memberId: user?.id ?? h.members[0]?.id ?? "u",
          kind: "debt_pay",
        };
        return {
          ...h,
          cashOnHand: Math.max(0, h.cashOnHand - pay),
          obligations: h.obligations.map((o) =>
            o.id === id
              ? { ...o, balance: Math.max(0, (o.balance ?? 0) - pay) }
              : o,
          ),
          transactions: [tx, ...h.transactions],
        };
      });
    },
    [user],
  );

  const inviteByNick = useCallback((nick: string) => {
    const n = nick.replace(/^@/, "").trim().toLowerCase();
    if (!n) return { ok: false as const, error: "Введите ник" };
    const h = household;
    if (h.members.length >= 2) {
      return { ok: false as const, error: "В бюджете уже двое" };
    }
    if (h.members.some((m) => m.nick === n)) {
      return { ok: false as const, error: "Этот человек уже в бюджете" };
    }
    setHousehold({
      ...h,
      members: [
        ...h.members,
        { id: `u-${n}`, name: n, nick: n, role: "member" },
      ],
    });
    return { ok: true as const, message: `Приглашение отправлено @${n}` };
  }, [household]);

  const value: BudgetContextValue = {
    user,
    household,
    login,
    register,
    logout,
    updateCash,
    updateSavings,
    updateDebt,
    addSpend,
    markDebtPayment,
    inviteByNick,
    periodView,
  };

  return (
    <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
  );
}

export function useBudget() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error("useBudget вне BudgetProvider");
  return ctx;
}
