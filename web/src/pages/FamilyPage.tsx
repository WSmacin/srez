import { useState, type FormEvent } from "react";
import { useBudget } from "../store/BudgetContext";

export function FamilyPage() {
  const { household, inviteByNick, logout } = useBudget();
  const [tab, setTab] = useState<"nick" | "link">("nick");
  const [nick, setNick] = useState("");
  const [msg, setMsg] = useState("");
  const link = `${window.location.origin}/invite/${household.inviteSlug}`;

  function onInvite(e: FormEvent) {
    e.preventDefault();
    if (household.members.length >= 2) {
      setMsg("В бюджете уже двое. Сначала кто-то должен выйти.");
      return;
    }
    const res = inviteByNick(nick);
    if (res.ok) {
      setMsg(res.message);
      setNick("");
    } else setMsg(res.error);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setMsg("Ссылка скопирована");
    } catch {
      setMsg(link);
    }
  }

  return (
    <>
      <h1 className="title">Семья</h1>

      {household.members.map((m) => (
        <div className="item" key={m.id} style={{ cursor: "default" }}>
          <div className="av" style={{ border: "none" }}>
            {m.name.slice(0, 1)}
          </div>
          <div className="meta">
            <div className="name">
              {m.name} · @{m.nick}
            </div>
            <div className="desc">
              {m.role === "owner" ? "владелец" : "участник"}
            </div>
          </div>
        </div>
      ))}

      <div className="sec">Пригласить</div>
      <div className="tabs">
        <button
          type="button"
          className={tab === "nick" ? "on" : undefined}
          onClick={() => setTab("nick")}
        >
          По нику
        </button>
        <button
          type="button"
          className={tab === "link" ? "on" : undefined}
          onClick={() => setTab("link")}
        >
          По ссылке
        </button>
      </div>

      {tab === "nick" ? (
        <form onSubmit={onInvite}>
          <div className="field">
            <label htmlFor="invNick">Ник</label>
            <div className="prefix">
              <span>@</span>
              <input
                id="invNick"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="друг"
              />
            </div>
          </div>
          <button className="btn primary full" type="submit">
            Пригласить
          </button>
        </form>
      ) : (
        <>
          <div className="link-box">{link}</div>
          <button className="btn primary full" type="button" onClick={copyLink}>
            Скопировать ссылку
          </button>
          <p className="hero-sub" style={{ marginTop: 10 }}>
            По ссылке человек запросит вход в ваш бюджет. Вы подтверждаете вход.
          </p>
        </>
      )}

      {msg ? <div className="chip" style={{ marginTop: 12 }}>{msg}</div> : null}

      <button className="btn linkish full" type="button" onClick={logout} style={{ marginTop: 16 }}>
        Выйти из аккаунта
      </button>
    </>
  );
}
