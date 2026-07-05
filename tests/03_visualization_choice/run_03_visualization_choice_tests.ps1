param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$PagePath = "/",
  [switch]$SkipBrowser
)

$ErrorActionPreference = "Stop"

$env:NODE_PATH = Join-Path $PSScriptRoot "..\..\versions\02_input_preprocessing\node_modules"
$env:PLAYWRIGHT_TEST_BASE_URL = $BaseUrl
$env:VISUALIZATION_CHOICE_PAGE_PATH = $PagePath

node --test tests/03_visualization_choice/visualization-choice.test.mjs

if (-not $SkipBrowser) {
  $Playwright = Join-Path $PSScriptRoot "..\..\versions\02_input_preprocessing\node_modules\.bin\playwright.cmd"
  & $Playwright test tests/03_visualization_choice/browser-page.spec.ts
}
