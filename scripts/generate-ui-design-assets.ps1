Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$outDir = Join-Path $root 'docs\screenshots\ui-design'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$colors = @{
  Ink = [System.Drawing.Color]::FromArgb(17, 24, 39)
  Muted = [System.Drawing.Color]::FromArgb(91, 104, 124)
  Blue = [System.Drawing.Color]::FromArgb(31, 78, 121)
  LightBlue = [System.Drawing.Color]::FromArgb(225, 239, 254)
  Green = [System.Drawing.Color]::FromArgb(220, 246, 232)
  Yellow = [System.Drawing.Color]::FromArgb(255, 247, 219)
  Purple = [System.Drawing.Color]::FromArgb(238, 232, 255)
  Gray = [System.Drawing.Color]::FromArgb(244, 246, 248)
  Border = [System.Drawing.Color]::FromArgb(113, 128, 150)
  White = [System.Drawing.Color]::White
}

function New-Canvas($title) {
  $bmp = New-Object System.Drawing.Bitmap 1600, 900
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $g.Clear($colors.White)
  Draw-Text $g $title 48 30 1500 44 24 ([System.Drawing.FontStyle]::Bold) $colors.Blue 'Left'
  return @{ Bitmap = $bmp; Graphics = $g }
}

function Draw-Text($g, $text, $x, $y, $w, $h, $size = 15, $style = [System.Drawing.FontStyle]::Regular, $color = $colors.Ink, $align = 'Center') {
  $font = New-Object System.Drawing.Font 'Segoe UI', $size, $style
  $brush = New-Object System.Drawing.SolidBrush $color
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = if ($align -eq 'Left') { [System.Drawing.StringAlignment]::Near } elseif ($align -eq 'Right') { [System.Drawing.StringAlignment]::Far } else { [System.Drawing.StringAlignment]::Center }
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF $x, $y, $w, $h
  $g.DrawString($text, $font, $brush, $rect, $fmt)
  $fmt.Dispose()
  $brush.Dispose()
  $font.Dispose()
}

function Draw-Box($g, $x, $y, $w, $h, $title, $subtitle = '', $fill = $colors.LightBlue) {
  $brush = New-Object System.Drawing.SolidBrush $fill
  $pen = New-Object System.Drawing.Pen $colors.Border, 2
  $rect = New-Object System.Drawing.Rectangle $x, $y, $w, $h
  $g.FillRectangle($brush, $rect)
  $g.DrawRectangle($pen, $rect)
  Draw-Text $g $title ($x + 14) ($y + 10) ($w - 28) 30 15 ([System.Drawing.FontStyle]::Bold)
  if ($subtitle) {
    Draw-Text $g $subtitle ($x + 16) ($y + 42) ($w - 32) ($h - 48) 11 ([System.Drawing.FontStyle]::Regular) $colors.Muted
  }
  $pen.Dispose()
  $brush.Dispose()
}

function Draw-Line($g, $x1, $y1, $x2, $y2) {
  $pen = New-Object System.Drawing.Pen $colors.Blue, 2
  $cap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap 5, 7
  $pen.CustomEndCap = $cap
  $g.DrawLine($pen, $x1, $y1, $x2, $y2)
  $cap.Dispose()
  $pen.Dispose()
}

function Draw-WireBox($g, $x, $y, $w, $h, $label = '') {
  $brush = New-Object System.Drawing.SolidBrush $colors.Gray
  $pen = New-Object System.Drawing.Pen $colors.Border, 2
  $g.FillRectangle($brush, $x, $y, $w, $h)
  $g.DrawRectangle($pen, $x, $y, $w, $h)
  if ($label) { Draw-Text $g $label $x $y $w $h 13 ([System.Drawing.FontStyle]::Bold) $colors.Muted }
  $pen.Dispose()
  $brush.Dispose()
}

function Save-Canvas($canvas, $name) {
  $file = Join-Path $outDir $name
  $canvas.Bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
  Write-Host "Wrote docs/screenshots/ui-design/$name"
}

function New-Sitemap {
  $c = New-Canvas 'Application Sitemap'
  $g = $c.Graphics

  Draw-Box $g 630 105 340 80 'SSE Live Ticker' 'single-page web application' $colors.Green
  $sections = @(
    @(70, 270, 'Dashboard', 'market stats, live ticker table'),
    @(390, 270, 'Authentication', 'login, register, Google, reset'),
    @(710, 270, 'Personal Area', 'watchlist, alerts, portfolio'),
    @(1030, 270, 'Modals', 'chart, alert editor, auth'),
    @(1290, 270, 'Backend API', 'REST endpoints and SSE')
  )
  foreach ($section in $sections) {
    Draw-Line $g 800 185 ($section[0] + 135) 270
    Draw-Box $g $section[0] $section[1] 270 92 $section[2] $section[3] $colors.LightBlue
  }

  $childRows = @(
    @(70, 420, @('Market tabs', 'Search/filter/sort', 'Live table', 'Theme switch')),
    @(390, 420, @('Email login', 'Register', 'Google sign-in', 'Forgot password')),
    @(710, 420, @('Favorites', 'Price alerts', 'Portfolio positions', 'P/L summary')),
    @(1030, 420, @('Chart modal', 'Alerts modal', 'Auth modal', 'Error states')),
    @(1290, 420, @('/api/health', '/api/stocks', '/events', '/api/auth/*'))
  )
  foreach ($row in $childRows) {
    $x = $row[0]
    $y = $row[1]
    foreach ($label in $row[2]) {
      Draw-Box $g $x $y 270 54 $label '' $colors.Gray
      $y += 68
    }
  }
  Save-Canvas $c '01-sitemap.png'
}

function New-UserFlow {
  $c = New-Canvas 'Main User Flow'
  $g = $c.Graphics
  $steps = @(
    @(70, 250, 'Open app', 'public dashboard'),
    @(345, 250, 'Watch ticker', 'SSE updates'),
    @(620, 250, 'Search / filter', 'find symbol'),
    @(895, 250, 'Open chart', 'inspect details'),
    @(1170, 250, 'Decision', 'continue or personalize')
  )
  foreach ($step in $steps) { Draw-Box $g $step[0] $step[1] 230 90 $step[2] $step[3] $colors.LightBlue }
  for ($i = 0; $i -lt 4; $i++) { Draw-Line $g ($steps[$i][0] + 230) 295 $steps[$i + 1][0] 295 }

  Draw-Box $g 350 540 230 90 'Login / register' 'email or Google' $colors.Yellow
  Draw-Box $g 650 540 230 90 'Add personal data' 'favorites, alerts, portfolio' $colors.Green
  Draw-Box $g 950 540 230 90 'Track outcome' 'alerts and P/L summary' $colors.Purple
  Draw-Line $g 1285 340 465 540
  Draw-Line $g 580 585 650 585
  Draw-Line $g 880 585 950 585
  Draw-Line $g 1065 540 1010 340
  Draw-Text $g 'No account needed for basic market view; account unlocks saved watchlist, alerts, and portfolio.' 180 745 1240 60 18 ([System.Drawing.FontStyle]::Bold) $colors.Muted
  Save-Canvas $c '02-user-flow.png'
}

function New-LandingWireframe {
  $c = New-Canvas 'First Screen Wireframe'
  $g = $c.Graphics
  Draw-WireBox $g 70 105 1460 70 'Top bar: brand, search, auth button, theme'
  Draw-WireBox $g 70 205 320 90 'Market status'
  Draw-WireBox $g 420 205 320 90 'Connection status'
  Draw-WireBox $g 770 205 320 90 'Watchlist count'
  Draw-WireBox $g 1120 205 410 90 'Portfolio summary'
  Draw-WireBox $g 70 330 240 420 'Filter sidebar / tabs'
  Draw-WireBox $g 340 330 1190 80 'Search, category tabs, sort controls'
  Draw-WireBox $g 340 435 1190 315 'Live market table'
  for ($i = 0; $i -lt 5; $i++) {
    $y = 485 + ($i * 48)
    $pen = New-Object System.Drawing.Pen $colors.Border, 1
    $g.DrawLine($pen, 365, $y, 1505, $y)
    $pen.Dispose()
  }
  Draw-WireBox $g 340 775 570 58 'Chart modal opens from row click'
  Draw-WireBox $g 960 775 570 58 'Alerts and portfolio actions require login'
  Save-Canvas $c '03-landing-wireframe.png'
}

function New-DashboardMockup {
  $source = Join-Path $root 'docs\screenshots\01-dashboard.png'
  $target = Join-Path $outDir '04-dashboard-mockup.png'
  if (Test-Path $source) {
    Copy-Item -LiteralPath $source -Destination $target -Force
    Write-Host 'Wrote docs/screenshots/ui-design/04-dashboard-mockup.png'
    return
  }

  $c = New-Canvas 'Dashboard Mockup'
  $g = $c.Graphics
  Draw-Box $g 70 110 1460 80 'SSE Live Ticker Dashboard' 'search, filters, auth, theme controls' $colors.Green
  Draw-Box $g 70 225 330 110 'Live status' 'connected via SSE' $colors.LightBlue
  Draw-Box $g 430 225 330 110 'Favorites' 'saved symbols' $colors.Yellow
  Draw-Box $g 790 225 330 110 'Alerts' 'active thresholds' $colors.Purple
  Draw-Box $g 1150 225 380 110 'Portfolio' 'position summary' $colors.Green
  Draw-WireBox $g 70 380 1460 410 'Ticker table with price, change, volume, and chart actions'
  Save-Canvas $c '04-dashboard-mockup.png'
}

New-Sitemap
New-UserFlow
New-LandingWireframe
New-DashboardMockup
