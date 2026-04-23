@echo off
setlocal

REM ─────────────────────────────────────────────────────────────────────
REM  OPALBAR — Levantar todo el stack de una (Postgres + Redis + API + Expo)
REM
REM  Primera ejecucion: pide UAC una sola vez para iniciar Postgres y
REM  dejarlo configurado como auto-arranque. Despues de un reboot,
REM  Postgres se inicia solo al encender Windows y este .bat ya no
REM  pedira permisos de administrador.
REM ─────────────────────────────────────────────────────────────────────

REM ---------- 0) ¿Postgres ya corre? Si si, saltar la elevacion ----------
sc query postgresql-x64-17 | find "RUNNING" >nul
if not errorlevel 1 (
    goto :skip_elevation
)

REM ---------- Auto-elevar a Administrador si no lo somos ----------
net session >nul 2>&1
if errorlevel 1 (
    echo Postgres no esta arriba. Solicitando permisos de administrador...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

REM ---------- (con admin) iniciar Postgres + dejarlo en auto-arranque ----------
echo [1/4] PostgreSQL (servicio postgresql-x64-17)...
sc config postgresql-x64-17 start= auto >nul 2>&1
net start postgresql-x64-17 >nul 2>&1
if errorlevel 1 (
    echo    [!] No se pudo iniciar PostgreSQL. Revisa el servicio postgresql-x64-17.
    pause
    exit /b 1
)
echo    [OK] PostgreSQL iniciado y configurado como auto-arranque.
goto :after_postgres

:skip_elevation
echo [1/4] PostgreSQL...
echo    [OK] PostgreSQL ya estaba corriendo.

:after_postgres
cd /d "C:\Users\Panda\Documents\opalbar-app"

REM ---------- 2) Redis ----------
echo.
echo [2/4] Redis...
tasklist /FI "IMAGENAME eq redis-server.exe" | find /I "redis-server.exe" >nul
if errorlevel 1 (
    start "OPALBAR - Redis" cmd /k "C:\Users\Panda\scoop\apps\redis\current\redis-server.exe --port 6379"
    echo    [OK] Redis lanzado en ventana aparte.
) else (
    echo    [OK] Redis ya estaba corriendo.
)

REM ---------- 3) API (NestJS) ----------
echo.
echo [3/4] API (NestJS) en puerto 3000...
start "OPALBAR - API" cmd /k "cd /d C:\Users\Panda\Documents\opalbar-app && npx nx serve api --skip-nx-cache"
echo    [OK] API lanzada. Espera a ver 'Nest application successfully started'.

REM ---------- 4) Expo (Metro) en LAN ----------
echo.
echo [4/4] Expo (Metro) en puerto 8081 (modo LAN)...
start "OPALBAR - Expo" cmd /k "cd /d C:\Users\Panda\Documents\opalbar-app\apps\mobile && npx expo start --clear"
echo    [OK] Expo lanzado.

echo.
echo ==========================================
echo   Todo arriba en ventanas separadas
echo.
echo   API    : http://192.168.100.13:3000/api/v1
echo   Health : http://192.168.100.13:3000/api/v1/health
echo   Expo   : exp://192.168.100.13:8081
echo.
echo   Escanea el QR desde Expo Go (telefono en la misma WiFi).
echo ==========================================
echo.
echo Para apagar: cierra las ventanas de Redis, API y Expo.
echo.
pause
endlocal
