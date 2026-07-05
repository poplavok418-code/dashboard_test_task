# 03 Visualization Choice

Третий срез проекта объединяет браузерную страницу предобработки данных из `02_input_preprocessing` и CLI-агент выбора визуализации.

## Браузерная страница

```bash
npm install
npm run dev
```

Страница открывается на `/`. Она принимает один файл или вставленный текст, проверяет вход, строит локальный профиль таблицы или текстовые фрагменты и показывает результат на русском языке.

## CLI выбор визуализации

```bash
node index.mjs --file ../../tests/03_visualization_choice/test_cases/bar_chart_semicolon.csv
```

CLI читает настройки из корневого `.env`, отправляет в LLM только компактный JSON-контекст и печатает только блок `suggested_visualization`.

## Проверки

Из корня репозитория:

```powershell
.\tests\03_visualization_choice\run_03_visualization_choice_tests.ps1 -BaseUrl http://localhost:3000 -PagePath /
```

CLI-тесты используют мок LLM-сервера и не требуют реального API-ключа.
