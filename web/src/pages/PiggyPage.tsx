import { Link } from "react-router-dom";
import type { CapMode } from "../lib/finance";
import { money } from "../lib/money";
import { useBudget } from "../store/BudgetContext";

export function PiggyPage() {
  const { household, updateSavings, updateCash, periodView } = useBudget();
  const { savingsYear, savingsIncome } = periodView;
  const progress = Math.min(
    100,
    Math.round((household.savingsBalance / Math.max(1, household.savingsGoal)) * 100),
  );

  return (
    <>
      <div className="row-top">
        <h1 className="title" style={{ margin: 0 }}>
          Копилка
        </h1>
        <Link className="back" to="/">
          Назад
        </Link>
      </div>

      <div className="card" style={{ background: "var(--sky-soft)", boxShadow: "none" }}>
        <div className="hero-label" style={{ color: "var(--sky)" }}>
          На сберегательном
        </div>
        <div className="hero-sum" style={{ color: "var(--sky)" }}>
          {money(household.savingsBalance)} ₽
        </div>
        <div className="hero-sub">
          Не входит в «можно тратить», пока не переведете на руки
        </div>
        <div className="bar">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="hero-sub" style={{ marginTop: 6 }}>
          Цель {money(household.savingsGoal)} · собрано {progress}%
        </div>
      </div>

      <div className="card">
        <div className="sec" style={{ marginTop: 0 }}>
          Условия вклада
        </div>
        <div className="field">
          <label htmlFor="depRate">Процент годовых</label>
          <div className="slider-row">
            <input
              id="depRate"
              type="range"
              min={0}
              max={25}
              step={0.1}
              value={household.savingsRate}
              onChange={(e) =>
                updateSavings(
                  household.savingsBalance,
                  Number(e.target.value),
                  household.savingsCap,
                )
              }
            />
            <strong>{String(household.savingsRate).replace(".", ",")}%</strong>
          </div>
        </div>
        <div className="field">
          <label htmlFor="cap">Капитализация</label>
          <select
            id="cap"
            value={household.savingsCap}
            onChange={(e) =>
              updateSavings(
                household.savingsBalance,
                household.savingsRate,
                e.target.value as CapMode,
              )
            }
          >
            <option value="m">Каждый месяц</option>
            <option value="q">Раз в квартал</option>
            <option value="y">В конце года</option>
          </select>
        </div>
        <div className="calc">
          Через 12 месяцев: <b>{money(savingsYear)} ₽</b>
          <br />
          Доход: <b>+{money(savingsIncome)} ₽</b>
        </div>
      </div>

      <div className="btn-row">
        <button
          className="btn primary"
          type="button"
          onClick={() => {
            const add = Math.min(3000, household.cashOnHand);
            if (add <= 0) return;
            updateSavings(
              household.savingsBalance + add,
              household.savingsRate,
              household.savingsCap,
            );
            updateCash(household.cashOnHand - add);
          }}
        >
          Пополнить +3 000
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            const move = Math.min(3000, household.savingsBalance);
            updateSavings(
              household.savingsBalance - move,
              household.savingsRate,
              household.savingsCap,
            );
            updateCash(household.cashOnHand + move);
          }}
        >
          На руки
        </button>
      </div>
    </>
  );
}
