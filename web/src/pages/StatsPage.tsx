import { money } from "../lib/money";
import { useBudget } from "../store/BudgetContext";

export function StatsPage() {
  const { household, periodView } = useBudget();
  const income = household.transactions
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + t.amount, 0);
  const debtPays = household.transactions
    .filter((t) => t.kind === "debt_pay")
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <>
      <h1 className="title">Итоги</h1>
      <div className="card">
        <div className="sec" style={{ marginTop: 0 }}>
          Сводка
        </div>
        <div className="item" style={{ boxShadow: "none", padding: "8px 0", margin: 0, cursor: "default" }}>
          <div className="meta">
            <div className="name">Доходы (учтено)</div>
          </div>
          <div className="amt">{money(income)}</div>
        </div>
        <div className="item" style={{ boxShadow: "none", padding: "8px 0", margin: 0, cursor: "default" }}>
          <div className="meta">
            <div className="name">Платежи по долгу</div>
          </div>
          <div className="amt teal">−{money(debtPays)}</div>
        </div>
        <div className="item" style={{ boxShadow: "none", padding: "8px 0", margin: 0, cursor: "default" }}>
          <div className="meta">
            <div className="name">Копилка сейчас</div>
          </div>
          <div className="amt sky">{money(household.savingsBalance)}</div>
        </div>
        <div className="item" style={{ boxShadow: "none", padding: "8px 0", margin: 0, cursor: "default" }}>
          <div className="meta">
            <div className="name">Прогноз дохода вклада / год</div>
          </div>
          <div className="amt sky">+{money(periodView.savingsIncome)}</div>
        </div>
      </div>

      {periodView.period ? (
        <div className="card">
          <div className="sec" style={{ marginTop: 0 }}>
            Текущий период
          </div>
          <div className="hero-sub">
            Свободно {money(periodView.summary.free)} ₽ из {money(periodView.summary.total)} ₽ ·
            обязательные {money(periodView.summary.obligatory)} ₽ · потрачено{" "}
            {money(periodView.spentInPeriod)} ₽
          </div>
        </div>
      ) : null}
    </>
  );
}
