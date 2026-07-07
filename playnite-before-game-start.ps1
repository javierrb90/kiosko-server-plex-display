# ==========================================================
# Playnite -> Express Webhook Test
# Before Game Starts Script
# ==========================================================

$serverUrl = "http://192.168.1.49:3000/webhook/playnite"

# ==========================================================
# Convierte una imagen de Playnite a Data URI (Base64)
# ==========================================================

function Convert-ToDataUri {

    param(
        [string]$RelativePath
    )

    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        return $null
    }

    $libraryRoot = Join-Path $env:APPDATA "Playnite\library\files"

    $fullPath = Join-Path $libraryRoot $RelativePath

    if (!(Test-Path $fullPath)) {

        Write-Host "Imagen no encontrada:"
        Write-Host $fullPath

        return $null

    }

    $extension = [System.IO.Path]::GetExtension($fullPath).ToLower()

    switch ($extension) {

        ".jpg"  { $mime = "image/jpeg" }
        ".jpeg" { $mime = "image/jpeg" }
        ".png"  { $mime = "image/png" }
        ".webp" { $mime = "image/webp" }

        default {

            Write-Host "Formato no soportado: $extension"

            return $null

        }

    }

    $bytes = [System.IO.File]::ReadAllBytes($fullPath)

    $base64 = [Convert]::ToBase64String($bytes)

    return "data:$mime;base64,$base64"

}

# ==========================================================
# Payload
# ==========================================================

$payload = @{

    title = $Game.Name

    platforms = @($Game.Platforms | ForEach-Object { $_.Name })

    developers = @($Game.Developers | ForEach-Object { $_.Name })

    publishers = @($Game.Publishers | ForEach-Object { $_.Name })

    genres = @($Game.Genres | ForEach-Object { $_.Name })

    releaseYear = $Game.ReleaseYear

    playtime = $Game.Playtime

    cover = Convert-ToDataUri $Game.CoverImage

    background = Convert-ToDataUri $Game.BackgroundImage

}

# ==========================================================
# Enviar webhook
# ==========================================================

try {

    $json = $payload | ConvertTo-Json -Depth 5

    Write-Host "Enviando webhook..."
    Write-Host "Tamaño JSON:" $json.Length "bytes"

    Invoke-RestMethod `
        -Uri $serverUrl `
        -Method POST `
        -ContentType "application/json" `
        -Body $json

    Write-Host "Webhook enviado correctamente."

}
catch {

    Write-Host "======================================="
    Write-Host "ERROR ENVIANDO WEBHOOK"
    Write-Host "======================================="
    Write-Host $_

}