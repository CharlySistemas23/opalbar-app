# ──────────────────────────────────────────────────────────────
#  OPAL BAR — Reboot completo (DB + API + Metro + QR)
#  Uso: doble clic en reboot-tunnel.bat
#
#  Lo que hace:
#    1.  Verifica Postgres + Redis (locales)
#    2.  Mata API vieja (puerto 3000)
#    3.  Mata Metro viejo (puerto 8095)
#    4.  Mata tuneles ssh viejos
#    5.  Arranca la API (npx nx serve api) en otra ventana
#    6.  Espera a que la API responda en 3000
#    7.  Levanta tunel localhost.run -> API (3000) y saca su URL
#    8.  Escribe EXPO_PUBLIC_API_URL en apps/mobile/.env
#    9.  Levanta tunel localhost.run -> Metro (8095)
#    10. Arranca Metro con EXPO_PACKAGER_PROXY_URL
#    11. Espera a Metro y valida manifest
#    12. Regenera QR y lo abre
# ──────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}
$ProjectRoot = $PSScriptRoot
$MobileDir   = Join-Path $ProjectRoot 'apps\mobile'
$MobileEnv   = Join-Path $MobileDir  '.env'
$QrPath      = Join-Path $MobileDir  'qr-expo-go-live-fixed.png'
$MetroTunLog = Join-Path $env:TEMP  'opalbar-metro-tunnel.log'
$ApiTunLog   = Join-Path $env:TEMP  'opalbar-api-tunnel.log'
$RedisExe    = Join-Path $ProjectRoot 'tools\redis\redis-server.exe'
$MetroPort   = 8095
$ApiPort     = 3000
$redisProcess = $null

Write-Host ''
Write-Host '===========================================' -ForegroundColor Yellow
Write-Host '  OPAL BAR - Reboot completo (DB+API+Metro)' -ForegroundColor Yellow
Write-Host '===========================================' -ForegroundColor Yellow
Write-Host ''

# ── Helpers ──────────────────────────────────────────────────
function Test-TcpPort {
  param([string]$TargetHost, [int]$Port, [int]$TimeoutMs = 800)
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($TargetHost, $Port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
    if (-not $ok) { return $false }
    $client.EndConnect($async)
    return $true
  } catch { return $false }
  finally { $client.Close() }
}

function Stop-PortOwner {
  param([int]$Port)
  try {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
      $conns | ForEach-Object {
        try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
      }
      Start-Sleep -Milliseconds 600
    }
  } catch {}
}

function Start-LhrTunnel {
  param([int]$LocalPort, [string]$LogFile)
  if (Test-Path $LogFile) { Remove-Item $LogFile -Force -ErrorAction SilentlyContinue }
  $errLog = [System.IO.Path]::ChangeExtension($LogFile, 'err')
  $proc = Start-Process -FilePath 'ssh' `
    -ArgumentList @(
      '-o','StrictHostKeyChecking=no',
      '-o','ServerAliveInterval=20',
      '-R',"80:localhost:$LocalPort",
      'nokey@localhost.run'
    ) `
    -RedirectStandardOutput $LogFile `
    -RedirectStandardError  $errLog `
    -NoNewWindow `
    -PassThru
  $url = $null
  for ($i = 0; $i -lt 30 -and -not $url; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Path $LogFile) {
      $content = Get-Content $LogFile -Raw -ErrorAction SilentlyContinue
      if ($content -match 'https://[a-z0-9]+\.lhr\.life') { $url = $matches[0] }
    }
  }
  return [pscustomobject]@{ Proc = $proc; Url = $url }
}

# ── 1. Verificar DB local ────────────────────────────────────
Write-Host '[1/12] Verificando Postgres + Redis locales...' -ForegroundColor Cyan
$pgUp = Test-TcpPort -TargetHost 'localhost' -Port 5432
if (-not $pgUp) {
  Write-Host '   Postgres no responde en 5432. Intentando arrancar el servicio de Windows...' -ForegroundColor Yellow
  $pgService = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'postgresql*' } | Select-Object -First 1
  if ($pgService) {
    try {
      if ($pgService.Status -ne 'Running') {
        Start-Service -Name $pgService.Name -ErrorAction Stop
        Write-Host "   Servicio $($pgService.Name) iniciado." -ForegroundColor Gray
      }
    } catch {
      Write-Host "   No se pudo iniciar $($pgService.Name): $_" -ForegroundColor Red
      Write-Host '   Prueba ejecutando este .bat como Administrador.' -ForegroundColor Yellow
    }
    for ($i = 0; $i -lt 15; $i++) {
      Start-Sleep -Seconds 2
      if (Test-TcpPort -TargetHost 'localhost' -Port 5432) { $pgUp = $true; break }
    }
  } else {
    Write-Host '   No se encontro un servicio de Windows llamado "postgresql*".' -ForegroundColor Red
  }
}
if (-not $pgUp) {
  Write-Host '   ERROR: Postgres sigue sin responder en localhost:5432.' -ForegroundColor Red
  Read-Host 'Presiona Enter para salir'
  exit 1
}
Write-Host '   Postgres OK.' -ForegroundColor Green
if (Test-TcpPort -TargetHost 'localhost' -Port 6379) {
  Write-Host '   Redis OK (ya estaba corriendo).' -ForegroundColor Green
} else {
  if (Test-Path $RedisExe) {
    Write-Host '   Redis abajo. Arrancando Redis portable (tools\redis)...' -ForegroundColor Gray
    $redisArgs = @('--port','6379','--appendonly','no')
    $redisProcess = Start-Process -FilePath $RedisExe `
      -ArgumentList $redisArgs `
      -WorkingDirectory (Split-Path $RedisExe) `
      -WindowStyle Hidden `
      -PassThru
    for ($i = 0; $i -lt 10; $i++) {
      Start-Sleep -Milliseconds 500
      if (Test-TcpPort -TargetHost 'localhost' -Port 6379) { break }
    }
    if (Test-TcpPort -TargetHost 'localhost' -Port 6379) {
      Write-Host '   Redis OK (portable).' -ForegroundColor Green
    } else {
      Write-Host '   ERROR: el Redis portable no arranco en 5s.' -ForegroundColor Red
      Read-Host 'Presiona Enter para salir'
      exit 1
    }
  } else {
    Write-Host "   ERROR: no se encontro Redis portable en: $RedisExe" -ForegroundColor Red
    Write-Host '   Reinstala descargando https://github.com/tporadowski/redis/releases' -ForegroundColor Yellow
    Read-Host 'Presiona Enter para salir'
    exit 1
  }
}

# ── 2. Matar API vieja ───────────────────────────────────────
Write-Host '[2/12] Cerrando API vieja (puerto 3000)...' -ForegroundColor Cyan
Stop-PortOwner -Port $ApiPort

# ── 3. Matar Metro viejo ─────────────────────────────────────
Write-Host '[3/12] Cerrando Metro viejo (puerto 8095)...' -ForegroundColor Cyan
Stop-PortOwner -Port $MetroPort

# ── 4. Matar tuneles ssh viejos ──────────────────────────────
Write-Host '[4/12] Cerrando tuneles ssh viejos...' -ForegroundColor Cyan
Get-Process ssh -ErrorAction SilentlyContinue | ForEach-Object {
  try { Stop-Process -Id $_.Id -Force } catch {}
}
Start-Sleep -Milliseconds 500

# ── 5. Arrancar API ──────────────────────────────────────────
Write-Host '[5/12] Arrancando API (npx nx serve api)...' -ForegroundColor Cyan
$apiProcess = Start-Process -FilePath 'cmd.exe' `
  -ArgumentList @('/c','npx','nx','serve','api') `
  -WorkingDirectory $ProjectRoot `
  -PassThru

# ── 6. Esperar API ───────────────────────────────────────────
Write-Host '[6/12] Esperando a la API (hasta 180s)...' -ForegroundColor Cyan
$apiReady = $false
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 2
  if (Test-TcpPort -TargetHost 'localhost' -Port $ApiPort -TimeoutMs 500) {
    $apiReady = $true; break
  }
}
if (-not $apiReady) {
  Write-Host "   ERROR: la API no respondio en el puerto $ApiPort en 180s." -ForegroundColor Red
  Write-Host '   Mira la ventana de la API para ver el error.' -ForegroundColor Yellow
  Read-Host 'Presiona Enter para salir'
  exit 1
}
Write-Host '   API OK (localhost:3000).' -ForegroundColor Green

# ── 7. Tunel para la API ─────────────────────────────────────
Write-Host '[7/12] Levantando tunel para la API (localhost.run -> 3000)...' -ForegroundColor Cyan
$apiTun = Start-LhrTunnel -LocalPort $ApiPort -LogFile $ApiTunLog
if (-not $apiTun.Url) {
  Write-Host '   ERROR: no se pudo obtener URL del tunel de API.' -ForegroundColor Red
  Read-Host 'Presiona Enter para salir'
  exit 1
}
$apiTunnelUrl = $apiTun.Url
$apiPublic    = "$apiTunnelUrl/api/v1"
Write-Host "   API publica: $apiPublic" -ForegroundColor Green

# ── 8. Escribir .env del mobile ──────────────────────────────
Write-Host '[8/12] Actualizando apps/mobile/.env con la URL publica de la API...' -ForegroundColor Cyan
try {
  $envLines = @()
  if (Test-Path $MobileEnv) {
    $envLines = Get-Content $MobileEnv
  }
  $replaced = $false
  $newLines = foreach ($line in $envLines) {
    if ($line -match '^\s*EXPO_PUBLIC_API_URL\s*=') {
      $replaced = $true
      "EXPO_PUBLIC_API_URL=$apiPublic"
    } else {
      $line
    }
  }
  if (-not $replaced) {
    $newLines = @($newLines) + "EXPO_PUBLIC_API_URL=$apiPublic"
  }
  $newLines | Set-Content -Path $MobileEnv -Encoding UTF8
  Write-Host "   .env escrito: EXPO_PUBLIC_API_URL=$apiPublic" -ForegroundColor Green
} catch {
  Write-Host "   ERROR escribiendo .env: $_" -ForegroundColor Red
  Read-Host 'Presiona Enter para salir'
  exit 1
}

# ── 9. Tunel para Metro ──────────────────────────────────────
Write-Host '[9/12] Levantando tunel para Metro (localhost.run -> 8095)...' -ForegroundColor Cyan
$metroTun = Start-LhrTunnel -LocalPort $MetroPort -LogFile $MetroTunLog
if (-not $metroTun.Url) {
  Write-Host '   ERROR: no se pudo obtener URL del tunel de Metro.' -ForegroundColor Red
  Read-Host 'Presiona Enter para salir'
  exit 1
}
$metroTunnelUrl = $metroTun.Url
Write-Host "   Metro tunel: $metroTunnelUrl" -ForegroundColor Green

# ── 10. Arrancar Metro ───────────────────────────────────────
Write-Host '[10/12] Arrancando Metro en 8095...' -ForegroundColor Cyan
$env:EXPO_PACKAGER_PROXY_URL = $metroTunnelUrl
$metroProcess = Start-Process -FilePath 'cmd.exe' `
  -ArgumentList @('/c','npx','expo','start','--lan','--port','8095') `
  -WorkingDirectory $MobileDir `
  -PassThru

# ── 11. Esperar a Metro + validar manifest ───────────────────
Write-Host '[11/12] Esperando a Metro (hasta 120s)...' -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$MetroPort/status" -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch {}
}
if (-not $ready) {
  Write-Host 'ERROR: Metro no arranco en 120s.' -ForegroundColor Red
  Read-Host 'Presiona Enter para salir'
  exit 1
}
Write-Host '   Metro listo.' -ForegroundColor Green
try {
  $headers = @{ 'Accept' = 'application/expo+json,application/json' }
  $r = Invoke-WebRequest -Uri "$metroTunnelUrl/?platform=ios" -Headers $headers -TimeoutSec 30 -UseBasicParsing
  if ($r.StatusCode -eq 200) {
    Write-Host '   Manifest OK (200).' -ForegroundColor Green
  }
} catch {
  Write-Host "   Warning: manifest aun no respondio ($_)" -ForegroundColor Yellow
}

# ── 12. QR ───────────────────────────────────────────────────
Write-Host '[12/12] Generando y abriendo QR...' -ForegroundColor Cyan
$expUrl   = "exp://$($metroTunnelUrl -replace 'https://','')"
$encoded  = [uri]::EscapeDataString($expUrl)
$qrApiUrl = "https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=$encoded"
try {
  if (Test-Path $QrPath) { Remove-Item $QrPath -Force }
  Invoke-WebRequest -Uri $qrApiUrl -OutFile $QrPath -TimeoutSec 15 -UseBasicParsing
  Start-Process $QrPath
  Write-Host '   QR abierto.' -ForegroundColor Green
} catch {
  Write-Host "   Error generando QR: $_" -ForegroundColor Red
}

Write-Host ''
Write-Host '===========================================' -ForegroundColor Green
Write-Host '  LISTO                                    ' -ForegroundColor Green
Write-Host '===========================================' -ForegroundColor Green
Write-Host ''
Write-Host "  API:       $apiPublic"                     -ForegroundColor White
Write-Host "  Metro:     $metroTunnelUrl"                -ForegroundColor White
Write-Host "  Expo Go:   $expUrl"                        -ForegroundColor White
Write-Host "  QR:        $QrPath"                        -ForegroundColor White
Write-Host ''
Write-Host '  Escanea el QR con Expo Go.                ' -ForegroundColor Yellow
Write-Host '  Deja esta ventana abierta mientras uses   ' -ForegroundColor Yellow
Write-Host '  la app. Cierrala para apagar todo.        ' -ForegroundColor Yellow
Write-Host ''
Read-Host 'Presiona Enter para cerrar (apagara tuneles, API y Metro)'

# Cleanup
try { Stop-Process -Id $apiTun.Proc.Id    -Force -ErrorAction SilentlyContinue } catch {}
try { Stop-Process -Id $metroTun.Proc.Id  -Force -ErrorAction SilentlyContinue } catch {}
try { Stop-Process -Id $apiProcess.Id     -Force -ErrorAction SilentlyContinue } catch {}
try { Stop-Process -Id $metroProcess.Id   -Force -ErrorAction SilentlyContinue } catch {}
if ($redisProcess) {
  try { Stop-Process -Id $redisProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
}
Stop-PortOwner -Port $ApiPort
Stop-PortOwner -Port $MetroPort
