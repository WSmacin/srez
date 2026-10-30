import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { BudgetProvider } from "./store/BudgetContext";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <BudgetProvider>
        <App />
      </BudgetProvider>
    </HashRouter>
  </StrictMode>,
);
