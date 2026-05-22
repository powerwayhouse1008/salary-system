while ($true) {
    git add .
    git commit -m "auto update $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git push
    Start-Sleep -Seconds 60
}