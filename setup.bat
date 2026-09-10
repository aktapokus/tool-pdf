@echo off
setlocal enabledelayedexpansion

REM Betigin calisma dizinini KENDI konumuna sabitle - "Yonetici olarak
REM calistir" bazi Windows kurulumlarinda calisma dizinini System32ye
REM sabitleyip goreli yol/robocopy komutlarini sessizce bozabiliyor.
cd /d "%~dp0"

echo ============================================
echo   PDF ARACI - TOOL KURULUM
echo ============================================
echo.

set DEFAULT_CORE=..\aktapokus-core
set /p CORE_PATH=Core klasoru nerede? [%DEFAULT_CORE%]:
if "%CORE_PATH%"=="" set CORE_PATH=%DEFAULT_CORE%

if not exist "%CORE_PATH%\core\docker-compose.yml" goto BADCORE
if not exist "%CORE_PATH%\.env" goto NOENV

echo [1/2] Dosyalar kopyalaniyor: %CORE_PATH%\tools\pdf\
if not exist "%CORE_PATH%\tools\pdf" mkdir "%CORE_PATH%\tools\pdf"
robocopy . "%CORE_PATH%\tools\pdf" /E /XF setup.bat uninstall.bat /XD data /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto COPYFAIL

echo.
echo [2/2] Container yeniden BUILD ediliyor (LibreOffice indirilecek,
echo       ilk kurulumda birkac dakika surebilir - sadece "restart" yetmez)...
pushd "%CORE_PATH%\core"
docker compose up -d --build
if errorlevel 1 goto BUILDFAIL
popd

echo.
echo ============================================
echo   PDF ARACI KURULDU
echo ============================================
echo   Arayuzu yenileyin: http://localhost:8000
echo   Tool listesinde "PDF Araci" gorunmeli.
echo ============================================
pause
exit /b 0

:BADCORE
echo [HATA] Belirtilen yolda aktapokus-core bulunamadi: %CORE_PATH%
echo        core\docker-compose.yml orada olmali.
pause
exit /b 1

:NOENV
echo [HATA] %CORE_PATH%\.env bulunamadi.
echo        Once core klasorunde setup.bat'i calistirip core kurulumunu
echo        tamamlayin, sonra bu betigi tekrar calistirin.
pause
exit /b 1

:COPYFAIL
echo [HATA] Dosyalar kopyalanamadi.
pause
exit /b 1

:BUILDFAIL
echo [HATA] Container build edilemedi. Yukaridaki hatayi kontrol edin.
popd
pause
exit /b 1
