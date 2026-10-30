import { Link, useParams } from "react-router-dom";
import { loanSchedule } from "../lib/finance";
import { formatMonthYearRu, money } from "../lib/money";
import { useBudget } from "../store/BudgetContext";

export function DebtPage() {
  const { id } = useParams();
  const { household, updateDebt, markDebtPayment, periodView } = useBudget();
  const debt =
    household.obligations.find((o) => o.id === id && o.kind === "debt") ??
    household.obligations.find((o) => o.kind === "debt");

  if (!debt) {
    return (
      <>
        <p className="empty">Долг не найден</p>
        <Link className="back" to="/">
          Назад
        </Link>
      </>
    );
  }

  const rate = debt.annualRate ?? 0;
  const pay = debt.amount;
  const balance = debt.balance ?? 0;
  const plan = loanSchedule(balance, rate, pay);
  const assigned = periodView.reserved.find((r) => r.id === debt.id)?.assignedPayDay;

  return (
    <>
      <div className="row-top">
        <h1 className="title" style={{ margin: 0, fontSize: 20 }}>
          {debt.name}
        </h1>
        <Link className="back" to="/">
          Назад
        </Link>
      </div>

      <div className="card">
        <div className="hero-label" style={{ color: "var(--amber)" }}>
          Остаток долга
        </div>
        <div className="hero-sum">{money(balance)} ₽</div>
        <div className="hero-sub">
          Платеж {money(pay)} ₽ · срок {debt.dueDay}-е
          {assigned ? ` · с зарплаты ${assigned}-е` : ""}
        </div>
      </div>

      <div className="card">
        <div className="sec" style={{ marginTop: 0 }}>
          Ставка и пересчет
        </div>
        <div className="field">
          <label htmlFor="loanRate">Процент годовых</label>
          <div className="slider-row">
            <input
              id="loanRate"
              type="range"
              min={0}
              max={40}
              step={0.1}
              value={rate}
              onChange={(e) =>
                updateDebt(debt.id, { annualRate: Number(e.target.value) })
              }
            />
            <strong>{String(rate).replace(".", ",")}%</strong>
          </div>
        </div>
        <div className="field">
          <label htmlFor="loanPay">Ежемесячный платеж, ₽</label>
          <input
            id="loanPay"
            value={pay}
            onChange={(e) =>
              updateDebt(debt.id, {
                amount: Number(String(e.target.value).replace(/\s/g, "")) || 0,
              })
            }
          />
        </div>
        <div className="calc">
          {plan.months == null ? (
            <>Платеж слишком мал для погашения при этой ставке. Увеличьте платеж.</>
          ) : (
            <>
              При {String(rate).replace(".", ",")}% и платеже {money(pay)} ₽:
              <br />
              закрытие примерно{" "}
              <b>{plan.payoffDate ? formatMonthYearRu(plan.payoffDate) : "—"}</b> ·{" "}
              {plan.months} мес
              <br />
              переплата по процентам ≈ <b>{money(plan.interestTotal ?? 0)} ₽</b>
            </>
          )}
        </div>
      </div>

      <div className="btn-row">
        <button
          className="btn primary"
          type="button"
          onClick={() => markDebtPayment(debt.id)}
        >
          Отметить платеж
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            const extra = 2000;
            updateDebt(debt.id, {
              balance: Math.max(0, balance - extra),
            });
          }}
        >
          Досрочно −2 000
        </button>
      </div>
    </>
  );
}
