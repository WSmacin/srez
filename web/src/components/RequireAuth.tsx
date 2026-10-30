import { Navigate, Outlet } from "react-router-dom";
import { useBudget } from "../store/BudgetContext";
import { BottomNav } from "./BottomNav";

export function RequireAuth() {
  const { user, ready } = useBudget();
  if (!ready) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <p className="hero-sub">Загрузка...</p>
        </main>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
