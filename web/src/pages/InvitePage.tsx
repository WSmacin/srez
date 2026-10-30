import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useBudget } from "../store/BudgetContext";

export function InvitePage() {
  const { slug = "" } = useParams();
  const { user, ready, joinBySlug } = useBudget();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!ready || !user || !slug || started.current) return;
    started.current = true;
    let cancelled = false;
    (async () => {
      setBusy(true);
      const res = await joinBySlug(slug);
      if (cancelled) return;
      setBusy(false);
      if (res.ok) {
        setDone(true);
        setMsg(res.message || "Вы в бюджете");
        setTimeout(() => navigate("/", { replace: true }), 900);
      } else {
        setMsg(res.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user, slug, joinBySlug, navigate]);

  if (!ready) {
    return (
      <div className="app-shell">
        <main className="app-main auth">
          <p className="hero-sub">Загрузка...</p>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-shell">
        <main className="app-main auth">
          <h1 className="title">Приглашение в бюджет</h1>
          <p className="hero-sub" style={{ marginBottom: 16 }}>
            Войдите или зарегистрируйтесь, затем откройте эту ссылку снова.
          </p>
          <Link className="btn primary full" to="/auth">
            Войти
          </Link>
        </main>
      </div>
    );
  }

  if (done) return <Navigate to="/" replace />;

  return (
    <div className="app-shell">
      <main className="app-main auth">
        <h1 className="title">Присоединение</h1>
        <p className="hero-sub">{busy ? "Подключаем к бюджету..." : msg || "Готово"}</p>
        {msg && !busy ? (
          <Link className="btn primary full" to="/" style={{ marginTop: 16 }}>
            На главную
          </Link>
        ) : null}
      </main>
    </div>
  );
}
