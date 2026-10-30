# Срез

Личный продукт: семейный cashflow-бюджет по периодам зарплаты.

**Прод:** https://srez.pages.dev  
Демо: `anya@mail.ru` / `demo1234`

| Путь | Что |
|------|-----|
| `design/` | UI-спека и HTML-прототип |
| `web/` | Веб-приложение (Vite + React) |

Деплой (с ПК, без wrangler/node-fetch к CF):

```powershell
cd web
powershell -ExecutionPolicy Bypass -File .\scripts\Deploy-CfPages.ps1
```

План: `D:\Knowledge\projects\budget-cashflow-app.md`

**Важно:** данные пока в localStorage браузера (на каждом телефоне свои). Общий семейный sync в облаке — следующий шаг (Supabase).
