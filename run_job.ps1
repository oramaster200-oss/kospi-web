# KOSPI 예측 자동화 실행 스크립트
$currentDir = Get-Location
Write-Host "--- [$(Get-Date)] 작업 시작 ---" -ForegroundColor Cyan

Write-Host "1. 데이터 로드 중..."
python data_loader.py

if ($LASTEXITCODE -eq 0) {
    Write-Host "2. 모델 학습 중..."
    python model.py
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "3. 예측 수행 중..."
    python predict.py
}

Write-Host "--- 작업 완료 ---" -ForegroundColor Green
