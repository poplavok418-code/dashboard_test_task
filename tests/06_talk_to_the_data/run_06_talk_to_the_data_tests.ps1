param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$PagePath = "/",
  [switch]$SkipBrowser
)

$ErrorActionPreference = "Stop"

$env:NODE_PATH = Join-Path $PSScriptRoot "..\..\versions\04_sheet_visualizations\node_modules"
$env:PLAYWRIGHT_TEST_BASE_URL = $BaseUrl
$env:TALK_TO_DATA_PAGE_PATH = $PagePath

node --test tests/06_talk_to_the_data/data-insight.test.mjs

if (-not $SkipBrowser) {
  $Playwright = Join-Path $PSScriptRoot "..\..\versions\04_sheet_visualizations\node_modules\.bin\playwright.cmd"
  & $Playwright test tests/06_talk_to_the_data/browser-data-insight.spec.ts
}
