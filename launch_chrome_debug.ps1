# launch_chrome_debug.ps1 – Chrome 원격 디버깅(9222) 실행 스크립트
# 실제 Chrome 실행 파일 경로를 자동 탐색 후 사용합니다.
# 1️⃣ Chrome 경로 탐색 (64bit 혹은 32bit)
$chromePath = ""
if (Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe") {
    $chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
} elseif (Test-Path "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe") {
    $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
} else {
    Write-Error "Chrome executable not found. Please install Chrome or specify the correct path."
    exit 1
}

# 2️⃣ 임시 프로필 사용 (기존 설정을 건드리지 않음)
$debugArgs = @(
    "--remote-debugging-port=9222",
    "--user-data-dir=$env:TEMP\chrome-debug"
)

# 3️⃣ Chrome 실행
Start-Process -FilePath $chromePath -ArgumentList $debugArgs -WindowStyle Normal
Write-Host "Chrome launched with remote debugging on port 9222."
