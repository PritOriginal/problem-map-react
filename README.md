# problem-map-react

[![wakatime](https://wakatime.com/badge/github/PritOriginal/problem-map-react.svg)](https://wakatime.com/badge/github/PritOriginal/problem-map-react)

В даннои репозитории представлено React SPA для дипломной работы по теме "Разработка краудсорсинговой системы мониторинга городских проблем с оптимизацией процессов модерации".

## О проекте

[problem-map.pritoriginal.ru](https://problem-map.pritoriginal.ru/) - сайт с развёрнутым приложением.

[problem-map-server](https://github.com/PritOriginal/problem-map-server) - Backend репозиторий.

> [!NOTE]  
> Этот проект находится в процессе активной разработки. В настоящее время в нём реализовано не всё запланированное, поэтому не исключено наличие ошибок.

## Стек

- `TypeScript`
- `React` - Фреймворк
- [`mobx-react`](https://github.com/mobxjs/mobx) - Управление состоянием
- [`react-router`](https://reactrouter.com/) - Маршрутизация
- `SCSS` - Препроцессор CSS
- [`Яндекс карты JavaScript API`](https://yandex.ru/maps-api/products/js-api) - Карта

## Подготовка

Создайте конфиг

```bash
cp ./.env.example ./.env
```

### Переменные окружения

| Переменная | Описание |
| --- | --- |
| `APP_HOST`, `APP_PORT` | Хост и порт dev-сервера Vite |
| `API_HOST`, `API_PORT` | Адрес backend-а, на который проксируются запросы `/api` |
| `VITE_YMAPS_API_KEY` | Ключ API Яндекс.Карт (JavaScript API 3.0). Переменные с префиксом `VITE_` попадают в клиентский бандл |

Файл `.env` не коммитится (см. `.gitignore`).

## Запуск

Запуск `dev` сервера для разработки

```bash
npm run dev
```

Билд приложения для `prod`

```bash
npm run build
```

## Проверки

```bash
npm run lint   # ESLint
npm test       # vitest
npm run build  # tsc + vite build
```

## Требует бэкенд integration/wave-3

Функции ниже написаны по контрактам ветки бэкенда `integration/wave-3` и без неё будут показывать ошибки загрузки / недоступность (остальной интерфейс работает):

- Уведомления: колокольчик в шапке (`GET /notifications/unread-count`, поллинг раз в 60 с), панель `/notifications` (`GET /notifications`, `PATCH /notifications/{id}/read`, `PATCH /notifications/read-all`).
- Профиль: блок «Статистика» (`GET /users/me/stats`); страница `/leaderboard` (`GET /leaderboard?limit=50`).
- Создание метки: проверка похожих (`GET /marks/similar?lon&lat&mark_type_id`), обработка `409` с `payload.similar_marks`, повтор с `POST /marks?force=true`.
- Карточка своей неподтверждённой метки: `PATCH /marks/{id}` (описание/тип), `DELETE /marks/{id}`; кнопка «Следить/Слежу» (`POST/DELETE /marks/{id}/follow`, поля `followers_count`, `is_following` в `Mark`).
- Тепловая карта: переключатель в фильтрах, `GET /map/heatmap?bbox&cell_m&mark_type_ids&mark_status_ids` (`cell_m`: zoom ≤12 → 1000, 13–14 → 500, ≥15 → 250).
- Дашборд `/analytics`: `GET /analytics/kpi`, `GET /analytics/timeseries?step=day|week|month` (фильтр по району из `admin-boundaries` и периоду).
