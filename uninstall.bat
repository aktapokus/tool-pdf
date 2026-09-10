@echo off
setlocal enabledelayedexpansion

REM Betigin calisma dizinini KENDI konumuna sabitle.
cd /d "%~dp0"

echo ============================================
echo   PDF ARACI - TOOL KALDIRMA
echo ============================================
echo.

set DEFAULT_CORE=..\aktapokus-core
set /p CORE_PATH=Core klasoru nerede? [%DEFAULT_CORE%]:
if "%CORE_PATH%"=="" set CORE_PATH=%DEFAULT_CORE%

if not exist "%CORE_PATH%\tools\pdf" goto NOTINSTALLED

echo Bu islem sunu SILECEK: %CORE_PATH%\tools\pdf\
echo (Yuklediginiz PDF oturumlari zaten gecici veridir, kalici bir dosyaniz
echo  etkilenmez - sadece bu tool'un kendi calisma dosyalari silinir.)
echo.
choice /c ED /m "Devam edilsin mi? (E=Evet, D=Dur)"
if errorlevel 2 goto CANCELLED

echo [1/2] Dosyalar siliniyor: %CORE_PATH%\tools\pdf\
rmdir /s /q "%CORE_PATH%\tools\pdf"
if exist "%CORE_PATH%\tools\pdf" goto DELFAIL

echo [2/2] Container yeniden baslatiliyor...
pushd "%CORE_PATH%\core"
docker compose restart app
popd

echo.
echo ============================================
echo   PDF ARACI KALDIRILDI
echo ============================================
echo   Arayuzu yenileyin: http://localhost:8000
echo   Not: LibreOffice, image icinde kurulu kaldi (core/Dockerfile'da).
echo   Kaldirmak isterseniz core repo'sunun Dockerfile'ini elle duzenleyip
echo   "docker compose up -d --build" calistirmaniz gerekir.
echo ============================================
pause
exit /b 0

:NOTINSTALLED
echo PDF Araci zaten kurulu degil: %CORE_PATH%\tools\pdf bulunamadi.
pause
exit /b 0

:CANCELLED
echo Iptal edildi, hicbir sey silinmedi.
pause
exit /b 0

:DELFAIL
echo [HATA] Dosyalar silinemedi - klasor kullanimda olabilir.
pause
exit /b 1
