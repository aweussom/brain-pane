# brain-pane installer, once per machine. Windows PowerShell 5.1 or pwsh.
#
# Does two things:
#   1. claude plugin install brain-pane --marketplace <owner>/brain-pane
#      (adds the marketplace on first run, installs at user scope)
#   2. sets "tui": "fullscreen" in ~/.claude/settings.json, because the
#      inline layout cuts the pane to a few rows.
# Re-running is safe. It writes nothing else.

$ErrorActionPreference = 'Stop'
$Marketplace = 'aweussom/brain-pane'

function Need($name, $hint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Host "brain-pane: '$name' is not on PATH. $hint" -ForegroundColor Red
        exit 1
    }
}
Need claude 'Install Claude Code first: https://claude.com/claude-code'
Need git   'The pane reads item ages with git log. Install Git for Windows.'

Write-Host "brain-pane: installing from $Marketplace ..."
& claude plugin install brain-pane --marketplace $Marketplace --scope user
if ($LASTEXITCODE -ne 0) {
    Write-Host "brain-pane: claude plugin install exited $LASTEXITCODE (already installed is fine; anything else, read the message above)." -ForegroundColor Yellow
}

# Fullscreen TUI. Merge one key, keep everything else, no BOM (Claude Code reads
# settings.json as plain JSON).
$settingsPath = Join-Path $HOME '.claude\settings.json'
$settings = $null
if (Test-Path $settingsPath) {
    $raw = Get-Content $settingsPath -Raw -Encoding UTF8
    if ($raw.Trim()) { $settings = $raw | ConvertFrom-Json }
}
if ($null -eq $settings) { $settings = [pscustomobject]@{} }

if ($settings.PSObject.Properties['tui'] -and $settings.tui -eq 'fullscreen') {
    Write-Host 'brain-pane: tui is already fullscreen.'
} else {
    $backup = ''
    if (Test-Path $settingsPath) {
        Copy-Item $settingsPath "$settingsPath.bak-brain-pane" -Force
        $backup = ' (backup: .bak-brain-pane)'
    }
    $settings | Add-Member -NotePropertyName tui -NotePropertyValue 'fullscreen' -Force
    New-Item -ItemType Directory -Force (Split-Path $settingsPath) | Out-Null
    $json = $settings | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($settingsPath, $json + "`n", (New-Object System.Text.UTF8Encoding $false))
    Write-Host "brain-pane: set tui=fullscreen in $settingsPath$backup."
}

Write-Host ''
Write-Host 'Done. Start claude in a repo that has a brain/ directory; the pane opens by itself. /brain toggles it.' -ForegroundColor Green
