param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$BasicPagePath = "/"
)

$ErrorActionPreference = "Stop"

$env:PLAYWRIGHT_TEST_BASE_URL = $BaseUrl
$env:BASIC_PAGE_PATH = $BasicPagePath

npx playwright test tests/01_basic_page/data-loader.spec.ts
