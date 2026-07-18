# ==========================================================
# Playnite -> BBQueue API v1
# Before Game Starts Script
# ==========================================================

$serverUrls = @(
    "http://192.168.1.50:3000/api/v1/events", # Producción
    "http://192.168.1.63:3000/api/v1/events"  # Desarrollo
)

# Déjalo vacío si BBQUEUE_API_TOKEN no está configurado.
$apiToken = ""

function Convert-ToDataUri {
    param([string]$RelativePath)

    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        return $null
    }

    $libraryRoot = Join-Path $env:APPDATA "Playnite\library\files"
    $fullPath = Join-Path $libraryRoot $RelativePath

    if (!(Test-Path $fullPath)) {
        Write-Warning "Imagen no encontrada: $fullPath"
        return $null
    }

    $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
    $mime = switch ($extension) {
        ".jpg"  { "image/jpeg" }
        ".jpeg" { "image/jpeg" }
        ".png"  { "image/png" }
        ".webp" { "image/webp" }
        default {
            Write-Warning "Formato no soportado: $extension"
            return $null
        }
    }

    try {
        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        $base64 = [Convert]::ToBase64String($bytes)
        return "data:$mime;base64,$base64"
    }
    catch {
        Write-Warning "No se pudo leer la imagen: $fullPath"
        Write-Warning $_
        return $null
    }
}

$platforms = @($Game.Platforms | ForEach-Object { $_.Name })
$developers = @($Game.Developers | ForEach-Object { $_.Name })
$publishers = @($Game.Publishers | ForEach-Object { $_.Name })
$genres = @($Game.Genres | ForEach-Object { $_.Name })

$platformText = ($platforms -join " · ")
if ([string]::IsNullOrWhiteSpace($platformText)) {
    $platformText = "Juego iniciado"
}

$gameId = $Game.Id.ToString()

$payload = @{
    source      = "playnite"
    externalId  = $gameId
    canonicalId = "playnite:$gameId"
    entityType  = "games"

    title  = $Game.Name
    detail = $platformText

    eventType = "started"
    occurredAt = [DateTime]::UtcNow.ToString("o")

    assets = @{
        poster   = Convert-ToDataUri $Game.CoverImage
        backdrop = Convert-ToDataUri $Game.BackgroundImage
    }

    metadata = @{
        gameId      = $gameId
        platforms   = $platforms
        developers  = $developers
        publishers  = $publishers
        genres      = $genres
        releaseYear = $Game.ReleaseYear
        playtime    = $Game.Playtime
    }

    behavior = @{
        createIfMissing = $true
        updateMetadata  = $true
        updateDetail    = $true
        updateActivity  = $true
        clearCharred    = $true
        showToast       = $true
    }
}

$json = $payload | ConvertTo-Json -Depth 8 -Compress
$headers = @{}
if (![string]::IsNullOrWhiteSpace($apiToken)) {
    $headers["Authorization"] = "Bearer $apiToken"
}

Write-Host "Payload preparado."
Write-Host "Juego:" $Game.Name
Write-Host "ID:" $gameId
Write-Host "Tamaño JSON:" $json.Length "bytes"

foreach ($serverUrl in $serverUrls) {
    try {
        Write-Host "---------------------------------------"
        Write-Host "Enviando evento a $serverUrl"

        $response = Invoke-RestMethod `
            -Uri $serverUrl `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json; charset=utf-8" `
            -Body $json `
            -TimeoutSec 15

        Write-Host "Evento enviado correctamente."
        Write-Host "Creado:" $response.created
        Write-Host "Toast emitido:" $response.toastEmitted
        Write-Host "Canonical ID:" $response.item.canonicalId
    }
    catch {
        Write-Host "======================================="
        Write-Host "ERROR ENVIANDO EVENTO A: $serverUrl"
        Write-Host "======================================="
        if ($_.Exception.Response) {
            Write-Host "Código HTTP:" ([int]$_.Exception.Response.StatusCode)
        }
        Write-Host $_
    }
}
