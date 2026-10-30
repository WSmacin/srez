import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDateRu, money } from "../lib/money";
import { useBudget } from "../store/BudgetContext";

export function HomePage() {
  const { user, household, periodView, addSpend } = useBudget();
  const { period, daysLeft, summary, reserved, savingsIncome } = periodView;
  const [sheet, setSheet] = useState(false);
  const [sum, setSum] = useState("450");
  const [title, setTitle] = useState("Продукты");

  const debt = household.obligations.find((o) => o.kind === "debt");
  const hint =
    summary.hints[0] ??
    "Обязательные платежи резервируются с зарплаты до срока оплаты.";

  return (
    <>
      <div className="row-top">
        <div>
          <div className="hello">Привет, {user?.name}</div>
          <h1 className="title" style={{ margin: 0, fontSize: 20 }}>
            Сейчас
          </h1>
        </div>
        <div className="avatars">
          {household.members.slice(0, 2).map((m) => (
            <div className="av" key={m.id}>
              {m.name.slice(0, 1)}
            </div>
          ))}
        </div>
      </div>

      {period ? (
        <div className="chip">
          {formatDateRu(period.start)} — {formatDateRu(period.end)} · еще {daysLeft} дн
        </div>
      ) : (
        <div className="chip">Добавьте даты зарплат в плане</div>
      )}

      <div className="card">
        <div className="hero-label">Можно тратить</div>
        <div className="hero-sum">{money(summary.free)} ₽</div>
        <div className="hero-sub">
          После обязательных с этой зарплаты. Копилка сюда не входит.
        </div>
        <div className="triplet">
          <div className="mini">
            <div className="k">Всего</div>
            <div className="v">{money(summary.total)}</div>
          </div>
          <div className="mini">
            <div className="k">Обязательные</div>
            <div className="v amber">{money(summary.obligatory)}</div>
          </div>
          <div className="mini">
            <div className="k">Осталось</div>
            <div className="v teal">{money(summary.free)}</div>
          </div>
        </div>
      </div>

      <div className="accounts">
        <Link className="acc cash" to="/accounts">
          <div className="k">На руках</div>
          <div className="v">{money(household.cashOnHand)} ₽</div>
        </Link>
        <Link className="acc save" to="/piggy">
          <div className="k">Копилка</div>
          <div className="v">{money(household.savingsBalance)} ₽</div>
        </Link>
      </div>

      <div className="hint">{hint}</div>

      <div className="sec">Ближайшее</div>
      {debt ? (
        <Link className="item" to={`/debt/${debt.id}`}>
          <div className="ico amber">%</div>
          <div className="meta">
            <div className="name">{debt.name}</div>
            <div className="desc">
              {debt.dueDay}-е · {debt.annualRate}% · с ЗП{" "}
              {reserved.find((r) => r.id === debt.id)?.assignedPayDay ?? "—"}
            </div>
          </div>
          <div className="amt amber">−{money(debt.amount)}</div>
        </Link>
      ) : null}

      <Link className="item" to="/piggy">
        <div className="ico sky">К</div>
        <div className="meta">
          <div className="name">Копилка · {household.savingsRate}%</div>
          <div className="desc">прогноз за год +{money(savingsIncome)}</div>
        </div>
        <div className="amt sky">{money(household.savingsBalance)}</div>
      </Link>

      <div className="btn-row">
        <button className="btn primary" type="button" onClick={() => setSheet(true)}>
          Добавить трату
        </button>
        <Link className="btn ghost" to="/accounts" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
          Счета
        </Link>
      </div>

      {sheet ? (
        <>
          <div className="sheet-backdrop" onClick={() => setSheet(false)} />
          <div className="sheet" role="dialog" aria-label="Новая трата">
            <div className="grab" />
            <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 800 }}>Новая трата</h3>
            <div className="field">
              <label htmlFor="sum">Сумма</label>
              <input id="sum" value={sum} onChange={(e) => setSum(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="title">Категория</label>
              <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="btn-row">
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  const n = Number(String(sum).replace(/\s/g, "").replace(",", "."));
                  if (n > 0) addSpend(title || "Трата", n);
                  setSheet(false);
                }}
              >
                Сохранить
              </button>
              <button className="btn ghost" type="button" onClick={() => setSheet(false)}>
                Отмена
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
