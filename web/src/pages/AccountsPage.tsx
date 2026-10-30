import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { money, parseAmount } from "../lib/money";
import { depositFuture } from "../lib/finance";
import { useBudget } from "../store/BudgetContext";

export function AccountsPage() {
  const { household, updateCash, updateSavings } = useBudget();
  const [cash, setCash] = useState(String(household.cashOnHand));
  const [save, setSave] = useState(String(household.savingsBalance));
  const [rate, setRate] = useState(String(household.savingsRate));
  const [savedMsg, setSavedMsg] = useState("");

  const preview = depositFuture(
    parseAmount(save),
    parseAmount(rate),
    12,
    household.savingsCap,
  );

  function onSave(e: FormEvent) {
    e.preventDefault();
    updateCash(parseAmount(cash));
    updateSavings(parseAmount(save), parseAmount(rate), household.savingsCap);
    setSavedMsg("Остатки сохранены");
  }

  return (
    <>
      <div className="row-top">
        <h1 className="title" style={{ margin: 0 }}>
          Счета
        </h1>
        <Link className="back" to="/">
          Назад
        </Link>
      </div>
      <p className="hero-sub" style={{ marginBottom: 12 }}>
        Сколько денег есть сейчас — не только будущая зарплата.
      </p>

      <form onSubmit={onSave}>
        <div className="card">
          <div className="sec" style={{ marginTop: 0 }}>
            На руках
          </div>
          <div className="field">
            <label htmlFor="cash">Наличные и карты (тратим отсюда)</label>
            <input id="cash" value={cash} onChange={(e) => setCash(e.target.value)} />
          </div>
          <div className="hero-sub">Входит в повседневные траты периода.</div>
        </div>

        <div className="card">
          <div className="sec" style={{ marginTop: 0 }}>
            Копилка / сбережения
          </div>
          <div className="field">
            <label htmlFor="save">Сейчас на сберегательном</label>
            <input id="save" value={save} onChange={(e) => setSave(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rate">Ставка вклада, % годовых</label>
            <input id="rate" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="calc">
            При {parseAmount(rate)}% через год примерно{" "}
            <b>{money(preview)} ₽</b> (доход ≈ {money(preview - parseAmount(save))} ₽).
          </div>
          <Link className="btn ghost full" to="/piggy" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
            Открыть копилку
          </Link>
        </div>

        {savedMsg ? <div className="chip">{savedMsg}</div> : null}
        <button className="btn primary full" type="submit">
          Сохранить остатки
        </button>
      </form>
    </>
  );
}
