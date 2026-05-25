Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$outDir = Join-Path $root 'docs\diagrams'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$colors = @{
  Ink = [System.Drawing.Color]::FromArgb(31, 41, 55)
  Muted = [System.Drawing.Color]::FromArgb(91, 104, 124)
  Blue = [System.Drawing.Color]::FromArgb(31, 78, 121)
  LightBlue = [System.Drawing.Color]::FromArgb(222, 237, 251)
  Green = [System.Drawing.Color]::FromArgb(219, 245, 232)
  Yellow = [System.Drawing.Color]::FromArgb(255, 246, 214)
  Red = [System.Drawing.Color]::FromArgb(255, 230, 230)
  Purple = [System.Drawing.Color]::FromArgb(238, 232, 255)
  Border = [System.Drawing.Color]::FromArgb(111, 129, 151)
  White = [System.Drawing.Color]::White
}

function New-Canvas($title) {
  $bmp = New-Object System.Drawing.Bitmap 1600, 900
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $g.Clear($colors.White)
  $font = New-Object System.Drawing.Font 'Segoe UI', 24, ([System.Drawing.FontStyle]::Bold)
  $brush = New-Object System.Drawing.SolidBrush $colors.Blue
  $g.DrawString($title, $font, $brush, 48, 34)
  $font.Dispose()
  $brush.Dispose()
  return @{ Bitmap = $bmp; Graphics = $g }
}

function Draw-Text($g, $text, $x, $y, $w, $h, $size = 18, $style = [System.Drawing.FontStyle]::Regular, $color = $colors.Ink, $align = 'Center') {
  $font = New-Object System.Drawing.Font 'Segoe UI', $size, $style
  $brush = New-Object System.Drawing.SolidBrush $color
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = if ($align -eq 'Left') { [System.Drawing.StringAlignment]::Near } else { [System.Drawing.StringAlignment]::Center }
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF $x, $y, $w, $h
  $g.DrawString($text, $font, $brush, $rect, $fmt)
  $fmt.Dispose()
  $brush.Dispose()
  $font.Dispose()
}

function Draw-Box($g, $x, $y, $w, $h, $title, $subtitle, $fill = $colors.LightBlue) {
  $fillBrush = New-Object System.Drawing.SolidBrush $fill
  $pen = New-Object System.Drawing.Pen $colors.Border, 2
  $rect = New-Object System.Drawing.Rectangle $x, $y, $w, $h
  $g.FillRectangle($fillBrush, $rect)
  $g.DrawRectangle($pen, $rect)
  Draw-Text $g $title ($x + 12) ($y + 12) ($w - 24) 34 17 ([System.Drawing.FontStyle]::Bold)
  if ($subtitle) {
    Draw-Text $g $subtitle ($x + 18) ($y + 52) ($w - 36) ($h - 62) 13 ([System.Drawing.FontStyle]::Regular) $colors.Muted
  }
  $fillBrush.Dispose()
  $pen.Dispose()
}

function Draw-Actor($g, $x, $y, $label) {
  $pen = New-Object System.Drawing.Pen $colors.Blue, 4
  $brush = New-Object System.Drawing.SolidBrush $colors.LightBlue
  $g.FillEllipse($brush, $x, $y, 90, 90)
  $g.DrawEllipse($pen, $x, $y, 90, 90)
  Draw-Text $g $label ($x - 50) ($y + 96) 190 58 15 ([System.Drawing.FontStyle]::Bold)
  $brush.Dispose()
  $pen.Dispose()
}

function Draw-Arrow($g, $x1, $y1, $x2, $y2, $label = '') {
  $pen = New-Object System.Drawing.Pen $colors.Blue, 3
  $cap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap 6, 8
  $pen.CustomEndCap = $cap
  $g.DrawLine($pen, $x1, $y1, $x2, $y2)
  if ($label) {
    $lx = [Math]::Min($x1, $x2)
    $ly = [Math]::Min($y1, $y2)
    Draw-Text $g $label ($lx + [Math]::Abs($x2 - $x1) / 2 - 130) ($ly + [Math]::Abs($y2 - $y1) / 2 - 26) 260 42 12 ([System.Drawing.FontStyle]::Regular) $colors.Muted
  }
  $cap.Dispose()
  $pen.Dispose()
}

function Draw-Table($g, $x, $y, $w, $title, $rows, $fill = $colors.LightBlue) {
  $rowH = 30
  $h = 42 + ($rows.Count * $rowH)
  Draw-Box $g $x $y $w $h $title '' $fill
  $topBrush = New-Object System.Drawing.SolidBrush $colors.Blue
  $g.FillRectangle($topBrush, $x, $y, $w, 42)
  Draw-Text $g $title ($x + 8) $y ($w - 16) 42 15 ([System.Drawing.FontStyle]::Bold) ([System.Drawing.Color]::White)
  $pen = New-Object System.Drawing.Pen $colors.Border, 1
  for ($i = 0; $i -lt $rows.Count; $i++) {
    $yy = $y + 42 + ($i * $rowH)
    $g.DrawLine($pen, $x, $yy, ($x + $w), $yy)
    Draw-Text $g $rows[$i] ($x + 12) $yy ($w - 24) $rowH 11 ([System.Drawing.FontStyle]::Regular) $colors.Ink 'Left'
  }
  $pen.Dispose()
  $topBrush.Dispose()
  return $h
}

function Save-Canvas($canvas, $name) {
  $file = Join-Path $outDir $name
  $canvas.Bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
  Write-Host "Wrote docs/diagrams/$name"
}

function New-ContextDiagram {
  $c = New-Canvas 'C4 Level 1 - System Context'
  $g = $c.Graphics
  Draw-Actor $g 86 355 'Market watcher'
  Draw-Box $g 390 330 360 190 'SSE Live Ticker' "Realtime market dashboard`nwatchlist, alerts, portfolio, auth" $colors.Green
  Draw-Box $g 905 140 300 135 'Google Identity' "Verifies optional Google Sign-In`nID token credentials" $colors.Purple
  Draw-Box $g 905 365 300 150 'Market Providers' "Optional live mode`nCoinGecko, Frankfurter, Yahoo proxy" $colors.Yellow
  Draw-Box $g 905 620 300 135 'Railway Hosting' "Builds and runs the Node service`npublic HTTPS domain" $colors.LightBlue
  Draw-Arrow $g 225 400 390 400 'uses via browser'
  Draw-Arrow $g 750 365 905 210 'verify token'
  Draw-Arrow $g 750 425 905 430 'optional sync'
  Draw-Arrow $g 905 675 750 505 'hosts'
  Save-Canvas $c 'context.png'
}

function New-ContainerDiagram {
  $c = New-Canvas 'C4 Level 2 - Container View'
  $g = $c.Graphics
  Draw-Actor $g 70 370 'User'
  Draw-Box $g 275 185 340 190 'Static Frontend' "HTML, CSS, JavaScript`nDashboard, modals, themes`nLightweight Charts" $colors.LightBlue
  Draw-Box $g 760 130 340 150 'Express REST API' "Auth, favorites, alerts, portfolio`nvalidation, rate limits, CSP" $colors.Green
  Draw-Box $g 760 365 340 135 'SSE Price Stream' "GET /events`nEventSource snapshots every 1.5s" $colors.Green
  Draw-Box $g 760 600 340 135 'Market Feed Engine' "Random-walk simulation`noptional provider adapters" $colors.Yellow
  Draw-Box $g 1220 325 280 190 'SQLite Database' "users, refresh/reset tokens`nfavorites, alerts, portfolio" $colors.Purple
  Draw-Arrow $g 210 420 275 300 'uses'
  Draw-Arrow $g 615 250 760 205 'REST /api/*'
  Draw-Arrow $g 615 330 760 430 'EventSource'
  Draw-Arrow $g 1100 205 1220 360 'prepared SQL'
  Draw-Arrow $g 930 600 930 500 'current prices'
  Save-Canvas $c 'container.png'
}

function New-SequenceDiagram {
  $c = New-Canvas 'Login and Session Sequence'
  $g = $c.Graphics
  $xs = @(210, 540, 870, 1200)
  $labels = @('User', 'Web UI', 'Express API', 'SQLite')
  for ($i = 0; $i -lt $xs.Count; $i++) {
    Draw-Box $g ($xs[$i] - 105) 120 210 70 $labels[$i] '' $colors.LightBlue
    $pen = New-Object System.Drawing.Pen $colors.Border, 2
    $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $g.DrawLine($pen, $xs[$i], 190, $xs[$i], 780)
    $pen.Dispose()
  }
  $y = 245
  $steps = @(
    @(0,1,'submit email/password or Google credential'),
    @(1,2,'POST /api/auth/login or /api/auth/google'),
    @(2,3,'SELECT or create linked user'),
    @(3,2,'user row + password/token state'),
    @(2,2,'bcrypt compare or Google token verification'),
    @(2,3,'INSERT refresh token hash'),
    @(2,1,'access_token + refresh_token + user'),
    @(1,1,'store tokens in localStorage'),
    @(1,2,'Bearer token REST calls'),
    @(2,1,'profile, favorites, alerts, portfolio')
  )
  foreach ($step in $steps) {
    $from = $xs[$step[0]]
    $to = $xs[$step[1]]
    if ($from -eq $to) {
      Draw-Box $g ($from + 24) ($y - 18) 270 45 $step[2] '' $colors.Yellow
    } else {
      Draw-Arrow $g $from $y $to $y $step[2]
    }
    $y += 58
  }
  Save-Canvas $c 'login-sequence.png'
}

function New-DeploymentDiagram {
  $c = New-Canvas 'Production Deployment Topology'
  $g = $c.Graphics
  Draw-Box $g 95 150 260 120 'Developer Machine' 'git commit and push' $colors.LightBlue
  Draw-Box $g 480 150 280 120 'GitHub Repository' 'Pacome5110/sse-live-ticker' $colors.LightBlue
  Draw-Box $g 885 150 300 120 'Railway Build' 'Nixpacks, Node 22, npm install' $colors.Green
  Draw-Box $g 885 390 300 145 'Railway Web Service' "npm start -> node server.js`n0.0.0.0:`$PORT" $colors.Green
  Draw-Box $g 480 620 280 120 'User Browser' 'HTTPS + EventSource' $colors.LightBlue
  Draw-Box $g 95 390 260 145 'Railway Variables' 'JWT_SECRET, DB_PATH, GOOGLE_CLIENT_ID' $colors.Yellow
  Draw-Box $g 1265 390 245 145 'SQLite Storage' "ticker.db`ncontainer path or volume" $colors.Purple
  Draw-Box $g 1265 620 245 120 'Google Identity' 'ID token verification' $colors.Purple
  Draw-Arrow $g 355 210 480 210 'push'
  Draw-Arrow $g 760 210 885 210 'auto deploy'
  Draw-Arrow $g 1035 270 1035 390 'release'
  Draw-Arrow $g 620 620 885 465 'public domain'
  Draw-Arrow $g 355 460 885 460 'env config'
  Draw-Arrow $g 1185 460 1265 460 'SQLite file'
  Draw-Arrow $g 1185 515 1265 655 'optional auth'
  Save-Canvas $c 'deployment.png'
}

function New-ErDiagram {
  $c = New-Canvas 'Database ER Diagram'
  $g = $c.Graphics
  $usersH = Draw-Table $g 625 115 350 'users' @(
    'id PK',
    'email UNIQUE',
    'password_hash',
    'name',
    'google_sub UNIQUE',
    'auth_provider',
    'created_at, updated_at'
  ) $colors.Green
  Draw-Table $g 120 165 300 'favorites' @('id PK','user_id FK','symbol','created_at','UNIQUE(user_id, symbol)') $colors.LightBlue | Out-Null
  Draw-Table $g 120 470 300 'alerts' @('id PK','user_id FK','symbol','target_price','direction','created_at') $colors.LightBlue | Out-Null
  Draw-Table $g 625 520 350 'portfolio_positions' @('id PK','user_id FK','symbol','quantity','average_price','created_at, updated_at','UNIQUE(user_id, symbol)') $colors.Yellow | Out-Null
  Draw-Table $g 1180 165 300 'refresh_tokens' @('id PK','user_id FK','token_hash UNIQUE','expires_at','revoked_at','created_at') $colors.Purple | Out-Null
  Draw-Table $g 1180 500 300 'password_reset_tokens' @('id PK','user_id FK','token_hash UNIQUE','expires_at','used_at','created_at') $colors.Red | Out-Null
  Draw-Arrow $g 625 255 420 235 '1:N'
  Draw-Arrow $g 625 325 420 535 '1:N'
  Draw-Arrow $g 800 380 800 520 '1:N'
  Draw-Arrow $g 975 255 1180 235 '1:N'
  Draw-Arrow $g 975 330 1180 565 '1:N'
  Save-Canvas $c 'erd.png'
}

New-ContextDiagram
New-ContainerDiagram
New-SequenceDiagram
New-DeploymentDiagram
New-ErDiagram
