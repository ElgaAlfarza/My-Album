@echo off
title Album Kenangan Saya — Lemari Foto Privat Keluarga
echo ======================================================================
echo   📸 MEMULAI ALBUM KENANGAN SAYA
echo ======================================================================
echo.
echo Berpindah ke folder backend...
cd /d "%~dp0backend"

echo Menjalankan server lemari kenangan...
node --use-system-ca src/server.js
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [ERROR] Gagal menjalankan server. Pastikan Node.js terinstall.
  pause
)
