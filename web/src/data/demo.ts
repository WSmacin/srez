import type { Household, SessionUser } from "../types";

export const DEMO_PASSWORD = "demo1234";

export const demoUser: SessionUser = {
  id: "u-anya",
  name: "Аня",
  nick: "anya",
  email: "anya@mail.ru",
};

export const demoHousehold: Household = {
  id: "hh-dom",
  inviteSlug: "anya-dom",
  members: [
    { id: "u-anya", name: "Аня", nick: "anya", role: "owner" },
    { id: "u-max", name: "Макс", nick: "max", role: "member" },
  ],
  cashOnHand: 24500,
  savingsBalance: 62000,
  savingsRate: 12,
  savingsCap: "m",
  savingsGoal: 100000,
  incomes: [
    {
      id: "inc-max",
      name: "Зарплата Макса",
      amount: 10000,
      days: [10, 25],
      memberId: "u-max",
    },
    {
      id: "inc-anya",
      name: "Зарплата Ани",
      amount: 18000,
      days: [5],
      memberId: "u-anya",
    },
  ],
  obligations: [
    {
      id: "ob-loan",
      name: "Кредит Альфа",
      kind: "debt",
      amount: 7000,
      dueDay: 30,
      frequency: "monthly",
      balance: 84000,
      annualRate: 18,
    },
    {
      id: "ob-netflix",
      name: "Подписка на кино",
      kind: "subscription",
      amount: 799,
      dueDay: 12,
      frequency: "monthly",
    },
    {
      id: "ob-osago",
      name: "ОСАГО",
      kind: "sinking",
      amount: 1200,
      dueDay: 15,
      frequency: "yearly",
      targetAmount: 14400,
      savedAmount: 1200,
    },
  ],
  transactions: [
    {
      id: "tx1",
      at: "2026-10-25T10:00:00",
      title: "Зарплата Макса",
      amount: 10000,
      memberId: "u-max",
      kind: "income",
    },
    {
      id: "tx2",
      at: "2026-10-25T10:01:00",
      title: "Резерв под кредит",
      amount: -7000,
      memberId: "u-anya",
      kind: "reserve",
    },
    {
      id: "tx3",
      at: "2026-10-28T18:20:00",
      title: "Продукты",
      amount: -1240,
      memberId: "u-anya",
      kind: "spend",
    },
    {
      id: "tx4",
      at: "2026-10-27T12:00:00",
      title: "Пополнение копилки",
      amount: -3000,
      memberId: "u-max",
      kind: "transfer",
    },
  ],
};
