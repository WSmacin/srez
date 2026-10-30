# Срез

Семейный cashflow-бюджет по периодам зарплаты.

**Прод (из РФ):** https://wsmacin.github.io/srez/  
**База:** Supabase Free (`norqhnglvxrniivsaglf`, Stockholm)  
Репо: https://github.com/WSmacin/srez (public)

| Путь | Что |
|------|-----|
| `design/` | UI-спека и HTML-прототип |
| `web/` | Vite + React (GitHub Pages) |
| `supabase/` | schema.sql (Postgres + RLS + RPC) |
| `worker/` | legacy Cloudflare Worker (не прод) |

## Деплой фронта

```powershell
cd web
npm run build
# затем содержимое dist/ в ветку gh-pages
```

План: `D:\Knowledge\projects\budget-cashflow-app.md`
