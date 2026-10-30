import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { AccountsPage } from "./pages/AccountsPage";
import { AuthPage } from "./pages/AuthPage";
import { DebtPage } from "./pages/DebtPage";
import { FamilyPage } from "./pages/FamilyPage";
import { FeedPage } from "./pages/FeedPage";
import { HomePage } from "./pages/HomePage";
import { PiggyPage } from "./pages/PiggyPage";
import { PlanPage } from "./pages/PlanPage";
import { StatsPage } from "./pages/StatsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/piggy" element={<PiggyPage />} />
        <Route path="/debt/:id" element={<DebtPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/family" element={<FamilyPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
