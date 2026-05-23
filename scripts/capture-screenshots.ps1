param(
  [string]$BaseUrl = "http://localhost:3001",
  [string]$OutputDir = "docs/screenshots"
)

$ErrorActionPreference = "Stop"

$edgeCandidates = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Google\Chrome\Application\chrome.exe"
)

$browser = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) {
  throw "No supported headless browser found. Install Microsoft Edge or Chrome."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$resolvedOutputDir = (Resolve-Path $OutputDir).Path

$shots = @(
  @{ Name = "01-dashboard.png"; Url = "$BaseUrl/?capture=dashboard"; Size = "1365,768" },
  @{ Name = "02-auth-modal.png"; Url = "$BaseUrl/?capture=auth"; Size = "1365,768" },
  @{ Name = "03-watchlist.png"; Url = "$BaseUrl/?capture=watchlist"; Size = "1365,768" },
  @{ Name = "04-alerts-modal.png"; Url = "$BaseUrl/?capture=alerts"; Size = "1365,768" },
  @{ Name = "05-chart-modal.png"; Url = "$BaseUrl/?capture=chart"; Size = "1365,768" },
  @{ Name = "06-mobile.png"; Url = "$BaseUrl/?capture=mobile"; Size = "390,844" },
  @{ Name = "07-empty-error-state.png"; Url = "$BaseUrl/?capture=error"; Size = "1365,768" },
  @{ Name = "08-theme-ocean.png"; Url = "$BaseUrl/?capture=theme&theme=ocean"; Size = "1365,768" }
)

foreach ($shot in $shots) {
  $out = Join-Path $resolvedOutputDir $shot.Name
  $profile = Join-Path ([System.IO.Path]::GetTempPath()) ("sse-live-ticker-capture-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $profile | Out-Null

  try {
    $args = @(
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--no-first-run",
      "--user-data-dir=$profile",
      "--window-size=$($shot.Size)",
      "--timeout=7000",
      "--screenshot=$out",
      $shot.Url
    )
    $process = Start-Process -FilePath $browser -ArgumentList $args -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne 0) {
      throw "Headless browser exited with code $($process.ExitCode) for $($shot.Name)"
    }
  } finally {
    if (Test-Path $profile) {
      Remove-Item -LiteralPath $profile -Recurse -Force
    }
  }

  if (-not (Test-Path $out)) {
    throw "Failed to create screenshot: $out"
  }
}

Write-Host "Captured $($shots.Count) screenshots in $OutputDir"
