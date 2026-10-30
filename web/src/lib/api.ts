import type { Household, SessionUser } from "../types";
import { supabase } from "./supabase";

type ApiOk<T> = { ok: true } & T;
type ApiErr = { ok: false; error: string };
type Result<T> = ApiOk<T> | ApiErr;

function mapErr(e: unknown, fallback: string): ApiErr {
  const msg =
    e && typeof e === "object" && "message" in e
      ? String((e as { message: string }).message)
      : fallback;
  const known: Record<string, string> = {
    "Invalid login credentials": "Неверный логин или пароль",
    "User already registered": "Почта уже зарегистрирована",
    "nick taken": "Ник занят",
    "nick too short": "Укажите ник",
    "user not found": "Пользователь с таким ником не найден. Пусть сначала зарегистрируется.",
    "household full": "В бюджете уже двое",
    "already member": "Этот человек уже в бюджете",
    "invalid invite": "Ссылка недействительна",
    "Email not confirmed": "Подтвердите почту по ссылке из письма",
  };
  for (const [k, v] of Object.entries(known)) {
    if (msg.toLowerCase().includes(k.toLowerCase())) return { ok: false, error: v };
  }
  return { ok: false, error: msg || fallback };
}

function asHousehold(raw: unknown): Household {
  return raw as Household;
}

async function loadProfileUser(): Promise<SessionUser | null> {
  const { data: auth } = await supabase.auth.getUser();
  const u = auth.user;
  if (!u) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nick, name, email")
    .eq("id", u.id)
    .maybeSingle();
  if (!profile) {
    return {
      id: u.id,
      email: u.email || "",
      nick: String(u.user_metadata?.nick || ""),
      name: String(u.user_metadata?.name || u.email || ""),
    };
  }
  return {
    id: profile.id,
    nick: profile.nick,
    name: profile.name,
    email: profile.email,
  };
}

async function ensureProfile(
  nick: string,
  name: string,
  email: string,
): Promise<Result<{ household: Household }>> {
  const { data, error } = await supabase.rpc("register_profile", {
    p_nick: nick,
    p_name: name,
    p_email: email,
  });
  if (error) {
    if (/profile exists/i.test(error.message)) {
      const hh = await supabase.rpc("get_my_household");
      if (hh.error) return mapErr(hh.error, "Не удалось загрузить бюджет");
      return { ok: true, household: asHousehold(hh.data) };
    }
    return mapErr(error, "Не удалось создать профиль");
  }
  return { ok: true, household: asHousehold(data) };
}

export type AuthPayload = {
  token: string;
  user: SessionUser;
  household: Household;
};

export async function apiLogin(id: string, password: string): Promise<Result<AuthPayload>> {
  try {
    const { data: emailData, error: resolveErr } = await supabase.rpc(
      "resolve_login_email",
      { login: id },
    );
    if (resolveErr) return mapErr(resolveErr, "Ошибка входа");
    const email = (emailData as string | null) || id.trim();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session || !data.user) {
      return mapErr(error || { message: "Неверный логин или пароль" }, "Неверный логин или пароль");
    }

    const hhRes = await supabase.rpc("get_my_household");
    if (hhRes.error) return mapErr(hhRes.error, "Не удалось загрузить бюджет");
    let household = hhRes.data ? asHousehold(hhRes.data) : null;
    if (!household) {
      const meta = data.user.user_metadata || {};
      const ensured = await ensureProfile(
        String(meta.nick || email.split("@")[0]),
        String(meta.name || ""),
        data.user.email || email,
      );
      if (!ensured.ok) return ensured;
      household = ensured.household;
    }

    const user = await loadProfileUser();
    if (!user) return { ok: false, error: "Нет профиля" };
    return {
      ok: true,
      token: data.session.access_token,
      user,
      household,
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
): Promise<Result<AuthPayload & { needsConfirm?: boolean }>> {
  try {
    const n = nick.replace(/^@/, "").trim().toLowerCase();
    const em = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: em,
      password,
      options: { data: { nick: n, name: name.trim() || n } },
    });
    if (error) return mapErr(error, "Не удалось зарегистрироваться");
    if (!data.user) return { ok: false, error: "Не удалось зарегистрироваться" };

    if (!data.session) {
      return {
        ok: false,
        error: "Проверьте почту и подтвердите регистрацию, затем войдите",
      };
    }

    const ensured = await ensureProfile(n, name.trim() || n, em);
    if (!ensured.ok) return ensured;
    const user = await loadProfileUser();
    if (!user) return { ok: false, error: "Нет профиля" };
    return {
      ok: true,
      token: data.session.access_token,
      user,
      household: ensured.household,
    };
  } catch (e) {
    return mapErr(e, "Нет связи с сервером");
  }
}

export async function apiMe(): Promise<Result<{ user: SessionUser; household: Household }>> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return { ok: false, error: "Нужен вход" };
    const user = await loadProfileUser();
    if (!user) return { ok: false, error: "Нужен вход" };
    let hhRes = await supabase.rpc("get_my_household");
    if (hhRes.error) return mapErr(hhRes.error, "Не удалось загрузить бюджет");
    if (!hhRes.data) {
      const ensured = await ensureProfile(
        user.nick || user.email.split("@")[0],
        user.name,
        user.email,
      );
      if (!ensured.ok) return ensured;
      return { ok: true, user, household: ensured.household };
    }
    return { ok: true, user, household: asHousehold(hhRes.data) };
  } catch (e) {
    return mapErr(e, "Нет связи с сервером");
  }
}

export async function apiPutHousehold(household: Household): Promise<Result<{ household: Household }>> {
  const { data, error } = await supabase.rpc("put_household", {
    payload: household,
  });
  if (error) return mapErr(error, "Не удалось сохранить");
  return { ok: true, household: asHousehold(data) };
}

export async function apiInviteByNick(
  nick: string,
): Promise<Result<{ message: string; household: Household }>> {
  const { data, error } = await supabase.rpc("invite_by_nick", { p_nick: nick });
  if (error) return mapErr(error, "Не удалось пригласить");
  const n = nick.replace(/^@/, "").trim().toLowerCase();
  return {
    ok: true,
    message: `Приглашение принято: @${n} в бюджете`,
    household: asHousehold(data),
  };
}

export async function apiJoinBySlug(
  slug: string,
): Promise<Result<{ message: string; household: Household }>> {
  const { data, error } = await supabase.rpc("join_by_slug", { p_slug: slug });
  if (error) return mapErr(error, "Не удалось присоединиться");
  return {
    ok: true,
    message: "Вы присоединились к бюджету",
    household: asHousehold(data),
  };
}

export async function apiLogout() {
  await supabase.auth.signOut();
}

/** kept for BudgetContext compatibility — session lives in supabase */
export function getToken(): string | null {
  return "supabase";
}

export function setToken(_token: string | null) {
  /* session handled by supabase-js */
}
