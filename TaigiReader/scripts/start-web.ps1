$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$node=Get-Command node -ErrorAction SilentlyContinue
if($node){$nodePath=$node.Source}else{$nodePath=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'}
if(!(Test-Path -LiteralPath $nodePath)){throw '請先安裝 Node.js 22 或以上版本'}
$ready=$false
try{$response=Invoke-WebRequest 'http://127.0.0.1:4317' -TimeoutSec 2 -UseBasicParsing;$ready=$response.StatusCode -eq 200}catch{}
if(!$ready){Start-Process -FilePath $nodePath -ArgumentList 'scripts/serve-web.cjs' -WorkingDirectory $root -WindowStyle Hidden;Start-Sleep -Seconds 2}
Start-Process 'http://127.0.0.1:4317'
