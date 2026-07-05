# 04 Sheet Visualizations

Четвертый срез проекта наследует `03_visualization_choice` и добавляет отображение графика по блоку `suggested_visualization`.

## Браузерная страница

```bash
npm install
npm run dev
```

Страница открывается на `/`. Скрипт `dev` использует Turbopack, чтобы обойти нестабильный webpack-dev manifest/runtime path в Next dev mode. Страница принимает один файл или вставленный текст, проверяет вход, строит локальный профиль таблицы или текстовые фрагменты, выбирает тип визуализации и показывает график, таблицу, KPI-карточки или понятное состояние без графика.

## CLI выбор визуализации

```bash
node index.mjs --file ../../tests/04_sheet_visualizations/test_cases/bar_chart_semicolon.csv
```

CLI читает настройки из корневого `.env`, отправляет в LLM только компактный JSON-контекст и печатает только блок `suggested_visualization`.

По умолчанию используется OpenAI-compatible endpoint `https://llm.c2devel.ru/v1` и модель `k2tex/qwen3.6-35b`. Для запуска с реальным LLM задайте в корневом `.env`:

```dotenv
LLM_API_KEY=<your-key>
LLM_BASE_URL=https://llm.c2devel.ru/v1
LLM_MODEL=k2tex/qwen3.6-35b
```

## Проверки

Из корня репозитория:

```powershell
.\tests\04_sheet_visualizations\run_04_sheet_visualizations_tests.ps1 -BaseUrl http://localhost:3000 -PagePath /
```

CLI-тесты используют мок LLM-сервера и не требуют реального API-ключа.
