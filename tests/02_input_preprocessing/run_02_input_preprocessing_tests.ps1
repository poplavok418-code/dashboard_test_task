param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$PagePath = "/"
)

$ErrorActionPreference = "Stop"

$env:PLAYWRIGHT_TEST_BASE_URL = $BaseUrl
$env:INPUT_PREPROCESSING_PAGE_PATH = $PagePath

$Playwright = Join-Path $PSScriptRoot "..\..\versions\02_input_preprocessing\node_modules\.bin\playwright.cmd"
& $Playwright test tests/02_input_preprocessing/preprocessing-unit.spec.ts tests/02_input_preprocessing/input-preprocessing.spec.ts
