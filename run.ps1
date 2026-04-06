$py = "C:\Users\mini\AppData\Local\Programs\Python\Python312\python.exe"
$script = $args[0]

if (-not $script) {
    Write-Host "--- KOSPI 예측 도구 사용법 ---" -ForegroundColor Cyan
    Write-Host "1. 데이터 업데이트: .\run.ps1 data_loader.py"
    Write-Host "2. 모델 학습시키기: .\run.ps1 model.py"
    Write-Host "3. 오늘의 종가 예측: .\run.ps1 predict.py"
    exit
}

$scriptPath = "C:\kospi\$script"
if (Test-Path $scriptPath) {
    & $py $scriptPath
} else {
    Write-Host "오류: '$script' 파일을 찾을 수 없습니다." -ForegroundColor Red
}
