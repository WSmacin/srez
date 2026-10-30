import { Link } from "react-router-dom";
import { money } from "../lib/money";
import { useBudget } from "../store/BudgetContext";

export function PlanPage() {
  const { household } = useBudget();

  return (
    <>
      <h1 className="title">План</h1>

      <div className="sec">Доходы</div>
      {household.incomes.map((inc) => (
        <div className="item" key={inc.id} style={{ cursor: "default" }}>
          <div className="ico">{inc.name.slice(0, 1)}</div>
          <div className="meta">
            <div className="name">{inc.name}</div>
            <div className="desc">
              {inc.days.join(" и ")} число · {money(inc.amount)} ₽
            </div>
          </div>
        </div>
      ))}

      <div className="sec">Обязательные</div>
      {household.obligations
        .filter((o) => o.kind !== "sinking")
        .map((o) => (
          <Link
            className="item"
            key={o.id}
            to={o.kind === "debt" ? `/debt/${o.id}` : "/plan"}
          >
            <div className={`ico ${o.kind === "debt" ? "amber" : ""}`}>
              {o.kind === "debt" ? "%" : "П"}
            </div>
            <div className="meta">
              <div className="name">
                {o.name}
                {o.annualRate != null ? ` · ${o.annualRate}%` : ""}
              </div>
              <div className="desc">
                {o.frequency === "monthly" ? "ежемесячно" : o.frequency} · {o.dueDay}-е
              </div>
            </div>
            <div className={`amt ${o.kind === "debt" ? "amber" : ""}`}>
              {money(o.amount)}
            </div>
          </Link>
        ))}

      <div className="sec">Копилки к сроку</div>
      {household.obligations
        .filter((o) => o.kind === "sinking")
        .map((o) => (
          <div className="item" key={o.id} style={{ cursor: "default" }}>
            <div className="ico sky">О</div>
            <div className="meta">
              <div className="name">{o.name}</div>
              <div className="desc">
                {money(o.amount)} с периода · {money(o.savedAmount ?? 0)} /{" "}
                {money(o.targetAmount ?? 0)}
              </div>
            </div>
          </div>
        ))}
    </>
  );
}
