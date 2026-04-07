# Windows 작업 스케줄러 등록 스크립트
$TaskName = "KOSPI_AI_Update"
$WorkingDir = Get-Location
$ScriptPath = Join-Path $WorkingDir "run_job.ps1"

# 실행할 동작 정의 (PowerShell로 run_job.ps1 실행)
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$ScriptPath`"" -WorkingDirectory $WorkingDir

# 07:00 시작, 매일 반복
$Trigger = New-ScheduledTaskTrigger -Daily -At 7:00am

# 30분 간격으로 2시간 동안 반복 (07:00 ~ 09:00)
$Trigger.Repetition = (New-ScheduledTaskTrigger -Once -At 7:00am).Repetition
$Trigger.Repetition.Interval = "PT30M"
$Trigger.Repetition.Duration = "PT2H"

# 작업 등록
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Description "Update KOSPI data and predict every 30min from 07:00 to 09:00" -Force

Write-Host "스케줄러에 '$TaskName' 작업이 성공적으로 등록되었습니다!" -ForegroundColor Green
Write-Host "실행 주기: 매일 오전 07:00부터 2시간 동안 30분마다" -ForegroundColor Cyan
