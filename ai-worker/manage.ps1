param([ValidateSet('start','stop','status','diagnose','install-startup','remove-startup')][string]$Action='status')
$ErrorActionPreference='Stop'
$workerRoot=$PSScriptRoot
$workerConfig=Get-Content -LiteralPath (Join-Path $workerRoot 'config.json') -Raw | ConvertFrom-Json
$workerRuntime=[IO.Path]::GetFullPath((Join-Path $workerRoot $workerConfig.runtimeDir))
$workerNode=(Get-Command node.exe).Source
$workerTask='FitzoLaptopWorker'
switch($Action){
 'start' {
  New-Item -ItemType Directory -Path $workerRuntime -Force | Out-Null
  Remove-Item -LiteralPath (Join-Path $workerRuntime 'stop') -Force -ErrorAction SilentlyContinue
  Start-Process -FilePath $workerNode -ArgumentList @(('"'+(Join-Path $workerRoot 'worker.js')+'"')) -WorkingDirectory $workerRoot -WindowStyle Hidden
 }
 'stop' {New-Item -ItemType Directory -Path $workerRuntime -Force | Out-Null; New-Item -ItemType File -Path (Join-Path $workerRuntime 'stop') -Force | Out-Null}
 'status' {& $workerNode (Join-Path $workerRoot 'worker.js') status}
 'diagnose' {& $workerNode (Join-Path $workerRoot 'worker.js') diagnose}
 'install-startup' {
  $workerExec=New-ScheduledTaskAction -Execute $workerNode -Argument ('"'+(Join-Path $workerRoot 'worker.js')+'"') -WorkingDirectory $workerRoot
  $workerTrigger=New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
  $workerSettings=New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName $workerTask -Action $workerExec -Trigger $workerTrigger -Settings $workerSettings -Description 'Outbound Fitzo AI worker; runs when signed in.' -Force | Out-Null
 }
 'remove-startup' {Unregister-ScheduledTask -TaskName $workerTask -Confirm:$false -ErrorAction SilentlyContinue}
}
