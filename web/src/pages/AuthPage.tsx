import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useBudget } from "../store/BudgetContext";

export function AuthPage() {
  const { user, ready, login, register } = useBudget();
  const [mode, setMode] = useState<"login" | "reg">("login");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [loginId, setLoginId] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [nick, setNick] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");

  if (!ready) {
    return (
      <div className="app-shell">
        <main className="app-main auth">
          <p className="hero-sub">Загрузка...</p>
        </main>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  function clearMessages() {
    setError("");
    setInfo("");
    setStatus("");
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    clearMessages();
    setStatus("Входим...");
    const res = await login(loginId, loginPass);
    setBusy(false);
    setStatus("");
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.pendingConfirm) {
      setInfo(res.message || "Подтвердите почту, затем войдите");
      return;
    }
  }

  async function onReg(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    clearMessages();
    setStatus("Создаем аккаунт...");
    const res = await register(nick, email, pass, name);
    setBusy(false);
    setStatus("");
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.pendingConfirm) {
      setInfo(
        res.message ||
          "Аккаунт создан. Подтвердите почту по ссылке из письма, затем войдите.",
      );
      setMode("login");
      setLoginId(res.email || email);
      setLoginPass("");
      return;
    }
    setInfo("Аккаунт создан — открываем бюджет");
  }

  return (
    <div className="app-shell">
      <main className="app-main auth">
        <div className="auth-logo">С</div>
        <h1 className="title">
          Добро пожаловать
          <br />в Срез
        </h1>
        <p className="hero-sub" style={{ marginBottom: 14 }}>
          Бюджет по периодам зарплаты — для вас и близкого человека.
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "on" : undefined}
            onClick={() => {
              setMode("login");
              clearMessages();
            }}
          >
            Вход
          </button>
          <button
            type="button"
            className={mode === "reg" ? "on" : undefined}
            onClick={() => {
              setMode("reg");
              clearMessages();
            }}
          >
            Регистрация
          </button>
        </div>

        {error ? <div className="hint">{error}</div> : null}
        {info ? <div className="hint ok">{info}</div> : null}
        {status ? <p className="hero-sub">{status}</p> : null}

        {mode === "login" ? (
          <form onSubmit={onLogin}>
            <div className="field">
              <label htmlFor="loginId">Почта или ник</label>
              <input
                id="loginId"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                autoComplete="username"
                placeholder="name@mail.ru"
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="loginPass">Пароль</label>
              <input
                id="loginPass"
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                autoComplete="current-password"
                disabled={busy}
              />
            </div>
            <button className="btn primary full" type="submit" disabled={busy}>
              {busy ? "Входим..." : "Войти"}
            </button>
            <p className="hero-sub" style={{ marginTop: 12, textAlign: "center" }}>
              Быстрее входить по почте. Ник тоже можно.
            </p>
          </form>
        ) : (
          <form onSubmit={onReg}>
            <div className="field">
              <label htmlFor="name">Имя</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="nick">Ник</label>
              <div className="prefix">
                <span>@</span>
                <input
                  id="nick"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="email">Почта</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="pass">Пароль</label>
              <input
                id="pass"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                disabled={busy}
              />
            </div>
            <button className="btn primary full" type="submit" disabled={busy}>
              {busy ? "Создаем аккаунт..." : "Создать аккаунт"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
