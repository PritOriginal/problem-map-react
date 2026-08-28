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
