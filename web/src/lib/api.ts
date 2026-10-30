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
      : fallback;
  const known: Record<string, string> = {
    "Invalid login credentials": "Неверный логин или пароль",
    "User already registered": "Эта почта уже зарегистрирована — войдите",
    "nick taken": "Ник занят — выберите другой",
    "nick too short": "Укажите ник",
    "user not found":
      "Пользователь с таким ником не найден. Пусть сначала зарегистрируется.",
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

function asHousehold(raw: unknown): Household {
  return raw as Household;
}

function looksLikeEmail(id: string) {
  return id.includes("@");
}

function sessionUserFromAuth(u: User, household?: Household | null): SessionUser {
  const mate = household?.members.find((m) => m.id === u.id);
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

async function resolveEmail(login: string): Promise<Result<{ email: string }>> {
  const raw = login.trim().replace(/^@/, "");
  if (looksLikeEmail(raw)) return { ok: true, email: raw.toLowerCase() };
  const { data, error } = await supabase.rpc("resolve_login_email", { login: raw });
  if (error) return mapErr(error, "Ошибка входа");
  if (!data) {
    return {
      ok: false,
      error: "Ник не найден. Войдите по почте или зарегистрируйтесь",
    };
  }
  return { ok: true, email: String(data) };
}

export async function apiLogin(id: string, password: string): Promise<AuthResult> {
  try {
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

    return {
      ok: true,
      token: data.session.access_token,
      user: sessionUserFromAuth(data.user, household),
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

    // Already registered: Supabase may return user without new identities
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
          "Аккаунт создан. Подтвердите почту по ссылке из письма, затем войдите.",
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

    const hhRes = await supabase.rpc("get_my_household");
    if (hhRes.error) return mapErr(hhRes.error, "Не удалось загрузить бюджет");
    if (!hhRes.data) {
      const meta = session.user.user_metadata || {};
      const ensured = await ensureProfile(
        String(meta.nick || (session.user.email || "").split("@")[0]),
        String(meta.name || ""),
        session.user.email || "",
      );
      if (!ensured.ok) return ensured;
      return {
        ok: true,
        user: sessionUserFromAuth(session.user, ensured.household),
        household: ensured.household,
      };
    }
    const household = asHousehold(hhRes.data);
    return {
      ok: true,
      user: sessionUserFromAuth(session.user, household),
      household,
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
