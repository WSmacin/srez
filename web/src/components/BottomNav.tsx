import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Сейчас", end: true },
  { to: "/feed", label: "Лента" },
  { to: "/plan", label: "План" },
  { to: "/stats", label: "Итоги" },
  { to: "/family", label: "Семья" },
];

export function BottomNav() {
  return (
    <nav className="nav" aria-label="Разделы">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => (isActive ? "active" : undefined)}
        >
          <span className="dot" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
