import { money } from "../lib/money";
import { useBudget } from "../store/BudgetContext";

export function FeedPage() {
  const { household } = useBudget();
  const byId = Object.fromEntries(household.members.map((m) => [m.id, m]));

  return (
    <>
      <h1 className="title">Лента</h1>
      {household.transactions.length === 0 ? (
        <p className="empty">Пока нет событий</p>
      ) : (
        household.transactions.map((t) => {
          const member = byId[t.memberId];
          const cls =
            t.amount > 0 ? "teal" : t.kind === "transfer" ? "sky" : "amber";
          return (
            <div className="item" key={t.id} style={{ cursor: "default" }}>
              <div className={`ico ${cls === "amber" ? "amber" : cls === "sky" ? "sky" : ""}`}>
                {t.kind === "income" ? "+" : t.kind === "transfer" ? "К" : "−"}
              </div>
              <div className="meta">
                <div className="name">{t.title}</div>
                <div className="desc">
                  {new Date(t.at).toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {member ? ` · ${member.name}` : ""}
                </div>
              </div>
              <div className={`amt ${cls}`}>
                {t.amount > 0 ? "+" : ""}
                {money(t.amount)}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
