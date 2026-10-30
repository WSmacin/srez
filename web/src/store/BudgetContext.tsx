import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  apiInviteByNick,
  apiJoinBySlug,
  apiLogin,
  apiLogout,
  apiMe,
  apiPutHousehold,
  apiRegister,
} from "../lib/api";
import { supabase } from "../lib/supabase";
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

type Result = { ok: true; message?: string } | { ok: false; error: string };

type BudgetContextValue = {
  user: SessionUser | null;
  household: Household;
  ready: boolean;
  syncing: boolean;
  login: (id: string, password: string) => Promise<Result>;
  register: (
    nick: string,
    email: string,
    password: string,
    name: string,
  ) => Promise<Result>;
  logout: () => void;
  updateCash: (n: number) => void;
  updateSavings: (balance: number, rate: number, cap: CapMode, goal?: number) => void;
  updateDebt: (id: string, patch: Partial<Obligation>) => void;
  addSpend: (title: string, amount: number) => void;
  markDebtPayment: (id: string) => void;
  inviteByNick: (nick: string) => Promise<Result>;
  joinBySlug: (slug: string) => Promise<Result>;
  periodView: ReturnType<typeof usePeriodView>;
};

const emptyHousehold: Household = {
  id: "",
  inviteSlug: "",
  members: [],
  cashOnHand: 0,
  savingsBalance: 0,
  savingsRate: 0,
  savingsCap: "m",
  savingsGoal: 100000,
  incomes: [],
  obligations: [],
  transactions: [],
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

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [household, setHousehold] = useState<Household>(emptyHousehold);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const periodView = usePeriodView(household);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true);

  const pushHousehold = useCallback((hh: Household) => {
    if (!hh.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSyncing(true);
      await apiPutHousehold(hh);
      setSyncing(false);
    }, 450);
  }, []);

  const applyHousehold = useCallback(
    (updater: (h: Household) => Household) => {
      setHousehold((prev) => {
        const next = updater(prev);
        pushHousehold(next);
        return next;
      });
    },
    [pushHousehold],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!cancelled) setReady(true);
        return;
      }
      const res = await apiMe();
      if (cancelled) return;
      if (res.ok && res.user && res.household) {
        skipSave.current = true;
        setUser(res.user);
        setHousehold(res.household);
      } else {
        await apiLogout();
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
    }
  }, [household]);

  const login = useCallback(async (id: string, password: string): Promise<Result> => {
    const res = await apiLogin(id, password);
    if (!res.ok) return res;
    skipSave.current = true;
    setUser(res.user);
    setHousehold(res.household);
    return { ok: true };
  }, []);

  const register = useCallback(
    async (
      nick: string,
      email: string,
      password: string,
      name: string,
    ): Promise<Result> => {
      const res = await apiRegister(nick, email, password, name);
      if (!res.ok) return res;
      skipSave.current = true;
      setUser(res.user);
      setHousehold(res.household);
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(() => {
    void apiLogout();
    setUser(null);
    skipSave.current = true;
    setHousehold(emptyHousehold);
  }, []);

  const updateCash = useCallback(
    (n: number) => {
      applyHousehold((h) => ({ ...h, cashOnHand: n }));
    },
    [applyHousehold],
  );

  const updateSavings = useCallback(
    (balance: number, rate: number, cap: CapMode, goal?: number) => {
      applyHousehold((h) => ({
        ...h,
        savingsBalance: balance,
        savingsRate: rate,
        savingsCap: cap,
        savingsGoal: goal ?? h.savingsGoal,
      }));
    },
    [applyHousehold],
  );

  const updateDebt = useCallback(
    (id: string, patch: Partial<Obligation>) => {
      applyHousehold((h) => ({
        ...h,
        obligations: h.obligations.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      }));
    },
    [applyHousehold],
  );

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
      applyHousehold((h) => ({
        ...h,
        cashOnHand: Math.max(0, h.cashOnHand - Math.abs(amount)),
        transactions: [tx, ...h.transactions],
      }));
    },
    [user, applyHousehold],
  );

  const markDebtPayment = useCallback(
    (id: string) => {
      applyHousehold((h) => {
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
    [user, applyHousehold],
  );

  const inviteByNick = useCallback(async (nick: string): Promise<Result> => {
    const res = await apiInviteByNick(nick);
    if (!res.ok) return res;
    skipSave.current = true;
    setHousehold(res.household);
    return { ok: true, message: res.message };
  }, []);

  const joinBySlug = useCallback(async (slug: string): Promise<Result> => {
    const res = await apiJoinBySlug(slug);
    if (!res.ok) return res;
    skipSave.current = true;
    setHousehold(res.household);
    return { ok: true, message: res.message };
  }, []);

  const value: BudgetContextValue = {
    user,
    household,
    ready,
    syncing,
    login,
    register,
    logout,
    updateCash,
    updateSavings,
    updateDebt,
    addSpend,
    markDebtPayment,
    inviteByNick,
    joinBySlug,
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
