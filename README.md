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

## Требует бэкенд integration/wave-4

Функции ниже написаны по контрактам ветки бэкенда `integration/wave-4` (все ответы в конверте `{success, payload, error, meta?}`); без неё панели показывают ошибку загрузки, остальной интерфейс работает:

- Задания `/tasks`: `GET /tasks/user/{id}?statuses=1,2,3&limit&offset` → `[{task_id, name, user_id, mark_id, status_id, due_at|null, …}]` (статусы: 1 Выдано, 2 Выполнено, 3 Просрочено; `GET /tasks/statuses` — необязательный словарь). Вкладки Текущие/Выполненные/Просроченные, карточка с меткой (тип, описание, «Показать на карте»), обратный отсчёт до `due_at` с подсветкой просрочки, кнопка «Проверить» → `/problem/:id/add-check` (`POST /checks`).
- Кабинет службы `/org` (только `role === "service"` в JWT-claim `role`, ссылка в шапке): `GET /organizations/me`, очередь `GET /organizations/{id}/marks?status_ids=2,7&overdue=true&limit&offset`, «Взять в работу» `POST /marks/{id}/start` (Подтверждённая → В работе, id 7), «Отчитаться» `POST /marks/{id}/resolve` (multipart `comment`, `photos[]`; В работе → На проверке). Для модератора/админа в карточке метки — селект «Назначить организацию» (`GET /organizations`, `PATCH /marks/{id}/assign {organization_id}`).
- В `Mark` ожидаются поля `organization_id|null`, `sla_due_at|null`, `is_overdue`: в карточке метки и списках показываются статус «В работе» (оранжевый), SLA-бейдж (осталось/просрочено) и организация.
- i18n ru/en: словари `src/i18n/{ru,en}.ts`, хук `useT()`, переключатель в шапке (persist в `localStorage.lang`); все запросы уходят с `Accept-Language: ru|en`, справочники (`GET /marks/types`, `/marks/statuses`, `/tasks/statuses`, `/organizations`) перезапрашиваются при смене языка. Справочники принимаются и в новом формате `{id, code, name}`, и в старом `{mark_type_id, name}`.
- Экспорт: кнопки GeoJSON/CSV в фильтрах карты открывают `GET /marks/export?format=geojson|csv&mark_type_ids&mark_status_ids` (текущие фильтры) в новой вкладке.
- PWA-минимум: `public/manifest.webmanifest` (SVG-иконка `public/icon.svg`), `public/sw.js` (app-shell — cache-first; GET `/api/*` справочники и список меток — network-first с fallback на кэш, отдельный кэш на язык), регистрация в `src/pwa.ts` только в production-сборке; баннер «Нет сети» по `navigator.onLine`.
