import { Navigate, Outlet } from "react-router-dom";
import { useBudget } from "../store/BudgetContext";
import { BottomNav } from "./BottomNav";

export function RequireAuth() {
  const { user } = useBudget();
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
