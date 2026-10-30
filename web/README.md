# Срез (web)

Семейный бюджет по периодам между зарплатами. Данные в облаке (Worker + KV).

## Запуск

```bash
cd D:\Labs\budget-cashflow\web
npm install
npm run dev
```

Откройте URL из терминала (обычно http://127.0.0.1:5173).

API по умолчанию: `https://srez-api.wsmacin.workers.dev`  
Локально можно переопределить через `VITE_API_URL` в `.env`.

## Стек

- Vite + React + TypeScript
- React Router
- Cloudflare Worker + KV (JWT, общий household)

## Дизайн

Канон: `../design/DESIGN.md` и прототип `../design/index.html`
