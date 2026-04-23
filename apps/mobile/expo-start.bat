@echo off
cd /d "C:\Users\Panda\Documents\opalbar-app\apps\mobile"
echo.
echo ========================================
echo         OPALBAR EXPO START
echo ========================================
echo.
echo 1. LAN    ^(misma red WiFi^)
echo 2. TUNNEL ^(acceso remoto por HTTPS^)
echo.
set "EXPO_MODE=1"
set /p EXPO_MODE=Selecciona modo [1/2]: 
echo.
if "%EXPO_MODE%"=="2" (
	echo Iniciando Expo en modo TUNNEL...
	npx expo start --clear --tunnel
) else (
	echo Iniciando Expo en modo LAN...
	npx expo start --clear
)
pause
