param(
  [string]$OldId = "io.ionic.starter",
  [string]$NewId = "com.derekriemer.boldexplorer",
  [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'

function Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Warning $msg }
function Fail($msg) { Write-Error $msg; exit 1 }

# Check adb
$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) { Fail "adb not found. Install Android Platform Tools and ensure adb is in PATH." }

# Ensure at least one device is connected
Info "Checking connected Android devices..."
$devices = & adb devices | Select-String -Pattern "`tdevice$" | ForEach-Object { $_.ToString().Split("`t")[0] }
if (-not $devices -or $devices.Count -eq 0) { Fail "No Android devices found. Connect a device or start an emulator (adb devices)." }
Info ("Found devices: {0}" -f ($devices -join ', '))

# Uninstall old/new package ids and legacy names (ignore errors)
if ($OldId) {
  Info "Uninstalling old app id '$OldId' (if installed)..."
  try { & adb uninstall $OldId | Out-Host } catch { Warn "Could not uninstall $OldId (may not be installed)." }
}

Info "Ensuring no stale install of new id '$NewId' exists..."
try { & adb uninstall $NewId | Out-Host } catch { Warn "Could not uninstall $NewId (may not be installed)." }

# Some older builds might have used an invalid plain name. Attempt removal just in case.
Info "Attempting uninstall of legacy package name 'bold_explorer' (if present)..."
try { & adb uninstall bold_explorer | Out-Host } catch { Warn "Could not uninstall bold_explorer (likely not installed)." }

# Capacitor sync (regenerate native files)
if (-not $NoBuild) {
  Info "Syncing Capacitor Android platform..."
  & pnpm cap sync android
  if ($LASTEXITCODE -ne 0) { Fail "Capacitor sync failed." }
}

# Gradle clean + installDebug
$androidDir = Join-Path $PSScriptRoot "..\android"
if (-not (Test-Path $androidDir)) { Fail "Android folder not found at $androidDir" }

Push-Location $androidDir
try {
  Info "Cleaning Gradle project..."
  & .\gradlew.bat clean
  if ($LASTEXITCODE -ne 0) { Fail "Gradle clean failed." }

  if (-not $NoBuild) {
    Info "Building and installing Debug APK..."
    & .\gradlew.bat :app:installDebug
    if ($LASTEXITCODE -ne 0) { Fail "Gradle installDebug failed." }
  }
}
finally {
  Pop-Location
}

# Launch the app
$component = "$NewId/.MainActivity"
Info "Launching $component ..."
& adb shell am start -n $component
if ($LASTEXITCODE -ne 0) { Fail "Failed to launch $component. Verify package/activity names and that the app is installed." }

Info "Done."
