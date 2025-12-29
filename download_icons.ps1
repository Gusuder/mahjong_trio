New-Item -ItemType Directory -Force assets\icons | Out-Null
$base = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg"
$codes = @("1f34e","1f34b","1f347","1f352","1f95d","1f351","1f349","1f353","1f34d","1f34a","1f965","1f350","1f34c","1fad0","1f955","1f36a")
foreach ($c in $codes) {
  Invoke-WebRequest "$base/$c.svg" -OutFile "assets\icons\$c.svg"
}
Write-Host "Done: Twemoji SVG icons downloaded into assets/icons/"
