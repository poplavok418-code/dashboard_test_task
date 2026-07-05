param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$PagePath = "/",
  [switch]$SkipBrowser
)

$ErrorActionPreference = "Stop"

$env:NODE_PATH = Join-Path $PSScriptRoot "..\..\versions\04_sheet_visualizations\node_modules"
$env:PLAYWRIGHT_TEST_BASE_URL = $BaseUrl
$env:SHEET_VISUALIZATIONS_PAGE_PATH = $PagePath

node --test tests/04_sheet_visualizations/visualization-choice.test.mjs

if (-not $SkipBrowser) {
  $Playwright = Join-Path $PSScriptRoot "..\..\versions\04_sheet_visualizations\node_modules\.bin\playwright.cmd"
  & $Playwright test tests/04_sheet_visualizations/browser-visualizations.spec.ts
}
