import type { User } from "@supabase/supabase-js";
import type { Household, SessionUser } from "../types";
import { supabase } from "./supabase";

type ApiOk<T> = { ok: true } & T;
type ApiErr = { ok: false; error: string };
type Result<T> = ApiOk<T> | ApiErr;

export type AuthOk = {
  ok: true;
  token: string;
  user: SessionUser;
  household: Household;
};

export type AuthPending = {
  ok: true;
  pendingConfirm: true;
  email: string;
  message: string;
};

export type AuthResult = AuthOk | AuthPending | ApiErr;

function mapErr(e: unknown, fallback: string): ApiErr {
  const msg =
    e && typeof e === "object" && "message" in e
      ? String((e as { message: string }).message)
      : String(e ?? fallback);
  if (/abort|timeout|timed out/i.test(msg)) {
    return {
      ok: false,
      error: "Сервер долго не отвечает. Проверьте интернет и попробуйте еще раз",
    };
  }
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) {
    return {
      ok: false,
      error: "Нет связи с сервером. Откройте сайт еще раз через минуту",
    };
  }
  const known: Record<string, string> = {
    "Invalid login credentials": "Неверный логин или пароль",
    "User already registered": "Эта почта уже зарегистрирована — войдите",
    "nick taken": "Ник занят — выберите другой",
    "nick too short": "Укажите ник",
    "user not found":
      "Пользователь с таким ником не найден. Войдите по почте",
    "household full": "В бюджете уже двое",
    "already member": "Этот человек уже в бюджете",
    "invalid invite": "Ссылка недействительна",
    "Email not confirmed": "Подтвердите почту по ссылке из письма, затем войдите",
  };
  for (const [k, v] of Object.entries(known)) {
    if (msg.toLowerCase().includes(k.toLowerCase())) return { ok: false, error: v };
  }
  return { ok: false, error: msg || fallback };
}

function emptyHouseholdShape(id = ""): Household {
  return {
    id,
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
}

export function asHousehold(raw: unknown): Household | null {
  let value: unknown = raw;
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "null") return null;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const base = emptyHouseholdShape(String(o.id ?? ""));
  return {
    ...base,
    id: String(o.id ?? ""),
    inviteSlug: String(o.inviteSlug ?? o.invite_slug ?? ""),
    cashOnHand: Number(o.cashOnHand ?? o.cash_on_hand ?? 0),
    savingsBalance: Number(o.savingsBalance ?? o.savings_balance ?? 0),
    savingsRate: Number(o.savingsRate ?? o.savings_rate ?? 0),
    savingsCap: (o.savingsCap ?? o.savings_cap ?? "m") as Household["savingsCap"],
    savingsGoal: Number(o.savingsGoal ?? o.savings_goal ?? 100000),
    incomes: Array.isArray(o.incomes) ? (o.incomes as Household["incomes"]) : [],
    obligations: Array.isArray(o.obligations)
      ? (o.obligations as Household["obligations"])
      : [],
    transactions: Array.isArray(o.transactions)
      ? (o.transactions as Household["transactions"])
      : [],
    members: Array.isArray(o.members) ? (o.members as Household["members"]) : [],
  };
}

function looksLikeEmail(id: string) {
  return id.includes("@");
}

function sessionUserFromAuth(u: User, household?: Household | null): SessionUser {
  const mate = household?.members?.find((m) => m.id === u.id);
  return {
    id: u.id,
    email: u.email || "",
    nick: mate?.nick || String(u.user_metadata?.nick || "").replace(/^@/, ""),
    name: mate?.name || String(u.user_metadata?.name || u.email || ""),
  };
}

async function ensureProfile(
  nick: string,
  name: string,
  email: string,
  attempt = 0,
): Promise<Result<{ household: Household }>> {
  const n =
    attempt === 0
      ? nick.replace(/^@/, "").trim().toLowerCase() || email.split("@")[0]
      : `${(nick || email.split("@")[0]).replace(/^@/, "").trim().toLowerCase().slice(0, 12)}${attempt}`;
  const { data, error } = await supabase.rpc("register_profile", {
    p_nick: n,
    p_name: name || n,
    p_email: email,
  });
  if (error) {
    if (/profile exists/i.test(error.message)) {
      const hh = await supabase.rpc("get_my_household");
      if (hh.error) return mapErr(hh.error, "Не удалось загрузить бюджет");
      const household = asHousehold(hh.data);
      if (!household) return { ok: false, error: "Бюджет не найден" };
      return { ok: true, household };
    }
    if (/nick taken/i.test(error.message) && attempt < 3) {
      return ensureProfile(nick, name, email, attempt + 1);
    }
    return mapErr(error, "Не удалось создать профиль");
  }
  const household = asHousehold(data);
  if (!household) return { ok: false, error: "Не удалось создать бюджет" };
  return { ok: true, household };
}

async function resolveEmail(login: string): Promise<Result<{ email: string }>> {
  const raw = login.trim().replace(/^@/, "");
  if (!raw) return { ok: false, error: "Укажите почту или ник" };
  if (looksLikeEmail(raw)) return { ok: true, email: raw.toLowerCase() };
  const { data, error } = await supabase.rpc("resolve_login_email", { login: raw });
  if (error) return mapErr(error, "Ошибка входа");
  if (!data) {
    return {
      ok: false,
      error: "Ник не найден. Войдите по почте, которой регистрировались",
    };
  }
  return { ok: true, email: String(data) };
}

async function loadHouseholdForUser(user: User): Promise<Result<{ household: Household }>> {
  const hhRes = await supabase.rpc("get_my_household");
  if (hhRes.error) return mapErr(hhRes.error, "Не удалось загрузить бюджет");
  let household = asHousehold(hhRes.data);
  if (!household) {
    const meta = user.user_metadata || {};
    return ensureProfile(
      String(meta.nick || (user.email || "user").split("@")[0]),
      String(meta.name || ""),
      user.email || "",
    );
  }
  return { ok: true, household };
}

export async function apiLogin(id: string, password: string): Promise<AuthResult> {
  try {
    if (!password) return { ok: false, error: "Введите пароль" };
    const resolved = await resolveEmail(id);
    if (!resolved.ok) return resolved;
    const email = resolved.email;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session || !data.user) {
      return mapErr(
        error || { message: "Неверный логин или пароль" },
        "Неверный логин или пароль",
      );
    }

    const loaded = await loadHouseholdForUser(data.user);
    if (!loaded.ok) return loaded;

    return {
      ok: true,
      token: data.session.access_token,
      user: sessionUserFromAuth(data.user, loaded.household),
      household: loaded.household,
    };
  } catch (e) {
    return mapErr(e, "Нет связи с сервером");
  }
}

export async function apiRegister(
  nick: string,
  email: string,
  password: string,
  name: string,
): Promise<AuthResult> {
  try {
    const n = nick.replace(/^@/, "").trim().toLowerCase();
    const em = email.trim().toLowerCase();
    if (n.length < 2) return { ok: false, error: "Укажите ник" };
    if (!em.includes("@")) return { ok: false, error: "Укажите почту" };
    if (password.length < 6) {
      return { ok: false, error: "Пароль не короче 6 символов" };
    }

    const { data, error } = await supabase.auth.signUp({
      email: em,
      password,
      options: { data: { nick: n, name: name.trim() || n } },
    });
    if (error) return mapErr(error, "Не удалось зарегистрироваться");
    if (!data.user) return { ok: false, error: "Не удалось зарегистрироваться" };

    const identities = data.user.identities ?? [];
    if (identities.length === 0) {
      return {
        ok: false,
        error: "Эта почта уже зарегистрирована — войдите",
      };
    }

    if (!data.session) {
      return {
        ok: true,
        pendingConfirm: true,
        email: em,
        message:
          "Аккаунт создан. Подтвердите почту по ссылке из письма, затем войдите по почте.",
      };
    }

    const ensured = await ensureProfile(n, name.trim() || n, em);
    if (!ensured.ok) return ensured;
    return {
      ok: true,
      token: data.session.access_token,
      user: sessionUserFromAuth(data.user, ensured.household),
      household: ensured.household,
    };
  } catch (e) {
    return mapErr(e, "Нет связи с сервером");
  }
}

export async function apiMe(): Promise<Result<{ user: SessionUser; household: Household }>> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const session = sess.session;
    if (!session?.user) return { ok: false, error: "Нужен вход" };

    const loaded = await loadHouseholdForUser(session.user);
    if (!loaded.ok) return loaded;
    return {
      ok: true,
      user: sessionUserFromAuth(session.user, loaded.household),
      household: loaded.household,
    };
  } catch (e) {
    return mapErr(e, "Нет связи с сервером");
  }
}

export async function apiPutHousehold(
  household: Household,
): Promise<Result<{ household: Household }>> {
  const { data, error } = await supabase.rpc("put_household", {
    payload: household,
  });
  if (error) return mapErr(error, "Не удалось сохранить");
  const next = asHousehold(data);
  if (!next) return { ok: false, error: "Не удалось сохранить" };
  return { ok: true, household: next };
}

export async function apiInviteByNick(
  nick: string,
): Promise<Result<{ message: string; household: Household }>> {
  const { data, error } = await supabase.rpc("invite_by_nick", { p_nick: nick });
  if (error) return mapErr(error, "Не удалось пригласить");
  const household = asHousehold(data);
  if (!household) return { ok: false, error: "Не удалось пригласить" };
  const n = nick.replace(/^@/, "").trim().toLowerCase();
  return {
    ok: true,
    message: `Приглашение принято: @${n} в бюджете`,
    household,
  };
}

export async function apiJoinBySlug(
  slug: string,
): Promise<Result<{ message: string; household: Household }>> {
  const { data, error } = await supabase.rpc("join_by_slug", { p_slug: slug });
  if (error) return mapErr(error, "Не удалось присоединиться");
  const household = asHousehold(data);
  if (!household) return { ok: false, error: "Не удалось присоединиться" };
  return {
    ok: true,
    message: "Вы присоединились к бюджету",
    household,
  };
}

export async function apiLogout() {
  await supabase.auth.signOut();
}
