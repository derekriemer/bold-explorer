# --- CONFIG ---
$root = "C:\Users\driem\programmer_shit\ionic\bold-explorer"
$android = Join-Path $root "android"

# 0) Close builders that might hold locks
"studio64","java","gradle","node","adb","kotlinc","d8" |
  ForEach-Object { Get-Process $_ -ErrorAction SilentlyContinue | Stop-Process -Force }

# 1) Remove ONLY build artifacts (keep source + lockfiles)
$toZap = @(
  (Join-Path $android ".gradle"),
  (Join-Path $android "app\build"),
  (Join-Path $android "capacitor-cordova-android-plugins\build"),
  (Join-Path $root   "www"),   # if generated
  (Join-Path $root   "dist")   # if generated
) | Where-Object { Test-Path $_ }

foreach ($p in $toZap) {
  cmd /c "attrib -R -S -H `"$p`" /S /D"
  Remove-Item -LiteralPath ("\\?\" + $p) -Recurse -Force -ErrorAction SilentlyContinue
}

# 2) Optional: nuke node_modules (SAFE for lockfile; we DO NOT touch pnpm-lock.yaml)
$nm = Join-Path $root "node_modules"
if (Test-Path $nm) {
  Remove-Item -LiteralPath ("\\?\" + $nm) -Recurse -Force -ErrorAction SilentlyContinue
}

# 3) Clear user caches that resurrect bad transforms (lockfile unaffected)
$home = $env:USERPROFILE
$gradleCaches = Join-Path $home ".gradle\caches"
@(
  "transforms-3","transforms-2","modules-2"
) | ForEach-Object {
  $p = Join-Path $gradleCaches $_
  if (Test-Path $p) { Remove-Item -LiteralPath ("\\?\" + $p) -Recurse -Force -ErrorAction SilentlyContinue }
}
Get-ChildItem $gradleCaches -Directory -Filter "build-cache-*" -ErrorAction SilentlyContinue |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

$androidBuildCache = Join-Path $home ".android\build-cache"
if (Test-Path $androidBuildCache) {
  Remove-Item -LiteralPath ("\\?\" + $androidBuildCache) -Recurse -Force -ErrorAction SilentlyContinue
}

# 4) Reinstall deps honoring your tracked lockfile
Set-Location $root
pnpm install --frozen-lockfile

# 5) Regenerate/sync Android outputs
npx cap sync android

# 6) Build with safer flags on Windows
Set-Location $android
$gp = Join-Path $android "gradle.properties"
@"
org.gradle.daemon=false
org.gradle.parallel=false
org.gradle.vfs.watch=false
"@ | Out-File -FilePath $gp -Append -Encoding utf8

.\gradlew clean
.\gradlew assembleDebug --no-daemon --no-parallel -Dorg.gradle.vfs.watch=false --stacktrace
