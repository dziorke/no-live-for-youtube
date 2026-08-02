param(
    [string]$Source = (Join-Path $PSScriptRoot "..\assets\branding\icon-chroma.png"),
    [string]$IconDirectory = (Join-Path $PSScriptRoot "..\assets\icons"),
    [string]$StoreDirectory = (Join-Path $PSScriptRoot "..\store-assets")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

New-Item -ItemType Directory -Force -Path $IconDirectory, $StoreDirectory | Out-Null

function New-ArgbBitmap {
    param([int]$Width, [int]$Height)
    return [System.Drawing.Bitmap]::new(
        $Width,
        $Height,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
}

function Save-ResizedPng {
    param(
        [System.Drawing.Image]$Image,
        [int]$Size,
        [string]$Path
    )
    $output = New-ArgbBitmap -Width $Size -Height $Size
    $graphics = [System.Drawing.Graphics]::FromImage($output)
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($Image, 0, 0, $Size, $Size)
        $output.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $output.Dispose()
    }
}

function Remove-GreenScreen {
    param([string]$InputPath)

    $input = [System.Drawing.Bitmap]::new($InputPath)
    $bitmap = New-ArgbBitmap -Width $input.Width -Height $input.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.DrawImageUnscaled($input, 0, 0)
    }
    finally {
        $graphics.Dispose()
        $input.Dispose()
    }

    $rectangle = [System.Drawing.Rectangle]::new(0, 0, $bitmap.Width, $bitmap.Height)
    $data = $bitmap.LockBits(
        $rectangle,
        [System.Drawing.Imaging.ImageLockMode]::ReadWrite,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )

    try {
        $byteCount = [Math]::Abs($data.Stride) * $bitmap.Height
        $pixels = [byte[]]::new($byteCount)
        [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixels, 0, $byteCount)

        for ($y = 0; $y -lt $bitmap.Height; $y++) {
            $row = $y * $data.Stride
            for ($x = 0; $x -lt $bitmap.Width; $x++) {
                $index = $row + ($x * 4)
                $blue = [int]$pixels[$index]
                $green = [int]$pixels[$index + 1]
                $red = [int]$pixels[$index + 2]
                $maxOther = [Math]::Max($red, $blue)
                $dominance = $green - $maxOther

                if ($dominance -gt 5 -and $green -gt 50) {
                    $strength = [Math]::Min(1.0, ($dominance - 5) / 150.0)
                    $alpha = [int][Math]::Round(255 * (1.0 - $strength))
                    if ($alpha -lt 10) { $alpha = 0 }
                    $pixels[$index + 3] = [byte]$alpha

                    if ($alpha -gt 0) {
                        $pixels[$index + 1] = [byte][Math]::Min($green, $maxOther + 10)
                    }
                }
                else {
                    $pixels[$index + 3] = 255
                }
            }
        }

        [Runtime.InteropServices.Marshal]::Copy($pixels, 0, $data.Scan0, $byteCount)
    }
    finally {
        $bitmap.UnlockBits($data)
    }

    return $bitmap
}

function New-StoreGraphic {
    param(
        [System.Drawing.Image]$Icon,
        [int]$Width,
        [int]$Height,
        [string]$Path,
        [scriptblock]$Draw
    )
    $bitmap = New-ArgbBitmap -Width $Width -Height $Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
        & $Draw $graphics $Icon $Width $Height
        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

$transparent = Remove-GreenScreen -InputPath $Source
try {
    Save-ResizedPng -Image $transparent -Size 1024 -Path (Join-Path $IconDirectory "icon1024.png")
    foreach ($size in 16, 32, 48, 128) {
        Save-ResizedPng -Image $transparent -Size $size -Path (Join-Path $IconDirectory "icon$size.png")
    }

    New-StoreGraphic -Icon $transparent -Width 440 -Height 280 -Path (Join-Path $StoreDirectory "promo-small-440x280.png") -Draw {
        param($graphics, $icon, $width, $height)
        $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            [System.Drawing.Point]::new(0, 0),
            [System.Drawing.Point]::new($width, $height),
            [System.Drawing.Color]::FromArgb(18, 18, 25),
            [System.Drawing.Color]::FromArgb(77, 14, 103)
        )
        $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
        $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(213, 202, 222))
        $title = [System.Drawing.Font]::new("Arial", 27, [System.Drawing.FontStyle]::Bold)
        $subtitle = [System.Drawing.Font]::new("Arial", 13, [System.Drawing.FontStyle]::Regular)
        try {
            $graphics.FillRectangle($background, 0, 0, $width, $height)
            $graphics.DrawImage($icon, 24, 54, 172, 172)
            $graphics.DrawString("No Live", $title, $white, 214, 76)
            $graphics.DrawString("for YouTube", $subtitle, $muted, 218, 119)
            $graphics.DrawString("A quieter autoplay queue", $subtitle, $muted, 218, 158)
        }
        finally {
            $background.Dispose(); $white.Dispose(); $muted.Dispose(); $title.Dispose(); $subtitle.Dispose()
        }
    }

    New-StoreGraphic -Icon $transparent -Width 1280 -Height 800 -Path (Join-Path $StoreDirectory "screenshot-settings-1280x800.png") -Draw {
        param($graphics, $icon, $width, $height)
        $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            [System.Drawing.Point]::new(0, 0),
            [System.Drawing.Point]::new($width, $height),
            [System.Drawing.Color]::FromArgb(14, 14, 20),
            [System.Drawing.Color]::FromArgb(48, 16, 62)
        )
        $panel = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(28, 28, 38))
        $row = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(38, 38, 50))
        $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
        $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(170, 170, 185))
        $accent = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(228, 29, 85))
        $title = [System.Drawing.Font]::new("Arial", 42, [System.Drawing.FontStyle]::Bold)
        $heading = [System.Drawing.Font]::new("Arial", 21, [System.Drawing.FontStyle]::Bold)
        $body = [System.Drawing.Font]::new("Arial", 16, [System.Drawing.FontStyle]::Regular)
        try {
            $graphics.FillRectangle($background, 0, 0, $width, $height)
            $graphics.DrawString("Control your YouTube queue", $title, $white, 74, 58)
            $graphics.DrawString("Hide live, upcoming, and archived livestreams with separate controls.", $body, $muted, 78, 122)
            $graphics.FillRectangle($panel, 72, 190, 1136, 530)
            $graphics.DrawImage($icon, 126, 278, 330, 330)
            $graphics.DrawString("No Live for YouTube", $heading, $white, 525, 232)
            $labels = @("Block live streams", "Hide upcoming streams", "Hide past live streams", "Skip during autoplay")
            for ($i = 0; $i -lt $labels.Count; $i++) {
                $top = 292 + ($i * 92)
                $graphics.FillRectangle($row, 520, $top, 610, 72)
                $graphics.DrawString($labels[$i], $body, $white, 548, $top + 22)
                $graphics.FillEllipse($accent, 1063, $top + 20, 42, 32)
                $graphics.FillEllipse($white, 1081, $top + 24, 24, 24)
            }
        }
        finally {
            $background.Dispose(); $panel.Dispose(); $row.Dispose(); $white.Dispose(); $muted.Dispose(); $accent.Dispose()
            $title.Dispose(); $heading.Dispose(); $body.Dispose()
        }
    }

    New-StoreGraphic -Icon $transparent -Width 1280 -Height 800 -Path (Join-Path $StoreDirectory "screenshot-features-1280x800.png") -Draw {
        param($graphics, $icon, $width, $height)
        $background = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(16, 16, 22))
        $card = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(37, 37, 47))
        $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
        $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(178, 178, 192))
        $accent = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(228, 29, 85))
        $crossPen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 16)
        $title = [System.Drawing.Font]::new("Arial", 42, [System.Drawing.FontStyle]::Bold)
        $heading = [System.Drawing.Font]::new("Arial", 20, [System.Drawing.FontStyle]::Bold)
        $body = [System.Drawing.Font]::new("Arial", 15, [System.Drawing.FontStyle]::Regular)
        try {
            $graphics.FillRectangle($background, 0, 0, $width, $height)
            $graphics.DrawImage($icon, 72, 60, 118, 118)
            $graphics.DrawString("Keep autoplay focused", $title, $white, 218, 70)
            $graphics.DrawString("Filtering runs locally in your browser. No analytics, accounts, or remote service.", $body, $muted, 223, 130)
            $items = @(
                @("LIVE NOW", "Currently broadcasting"),
                @("UPCOMING", "Scheduled broadcasts"),
                @("STREAMED", "Automatically archived streams")
            )
            for ($i = 0; $i -lt $items.Count; $i++) {
                $left = 72 + ($i * 400)
                $graphics.FillRectangle($card, $left, 250, 344, 390)
                $graphics.FillEllipse($accent, $left + 95, 286, 154, 154)
                $graphics.DrawLine($crossPen, $left + 139, 330, $left + 205, 396)
                $graphics.DrawLine($crossPen, $left + 205, 330, $left + 139, 396)
                $graphics.DrawString($items[$i][0], $heading, $white, $left + 30, 482)
                $graphics.DrawString($items[$i][1], $body, $muted, $left + 30, 528)
                $graphics.DrawString("Hidden from feeds and autoplay", $body, $muted, $left + 30, 566)
            }
            $graphics.DrawString("Early testing release - YouTube changes may temporarily affect detection.", $body, $muted, 76, 706)
        }
        finally {
            $background.Dispose(); $card.Dispose(); $white.Dispose(); $muted.Dispose(); $accent.Dispose(); $crossPen.Dispose()
            $title.Dispose(); $heading.Dispose(); $body.Dispose()
        }
    }
}
finally {
    $transparent.Dispose()
}

Write-Output "Generated extension icons and store artwork."
