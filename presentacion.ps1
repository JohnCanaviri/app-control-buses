param([string]$src, [string]$dst)
$ErrorActionPreference = "Stop"
function RGB($r, $g, $b) { $r + $g * 256 + $b * 65536 }
$NAVY = RGB 31 56 100;   $NAVYt = RGB 214 220 228
$BLUE = RGB 46 117 182;  $BLUEt = RGB 221 235 247
$GREEN = RGB 84 130 53;  $GREENt = RGB 226 239 218
$ORANGE = RGB 197 90 17; $ORANGEt = RGB 252 228 214
$GREY = RGB 242 242 242; $LINE = RGB 191 191 191; $WHITE = RGB 255 255 255
$DARKTXT = RGB 64 64 64

$x = New-Object -ComObject Excel.Application; $x.Visible = $false; $x.DisplayAlerts = $false
$wb = $x.Workbooks.Open($src)
$x.Calculation = -4135
try {
$MON = "#.##0,00;[Rojo]-#.##0,00"
try { $wb.Worksheets.Item("Cálculo").Range("Z1").NumberFormatLocal = $MON } catch { $MON = "#.##0,00;[Red]-#.##0,00" }
$wb.Worksheets.Item("Cálculo").Range("Z1").NumberFormatLocal = "General"
$MONZ = $MON + ';"-"'

function Band($rg, $fill, $font) { $rg.Interior.Color = $fill; $rg.Font.Color = $font; $rg.Font.Bold = $true }
function Box($rg) { foreach ($e in 7,8,9,10,11,12) { try { $b = $rg.Borders.Item($e); $b.LineStyle = 1; $b.Weight = 2; $b.Color = $LINE } catch {} } }
function Title($ws, $rng, $formulaOrText) {
  $rg = $ws.Range($rng); Band $rg $NAVY $WHITE
  $c = $ws.Range($rng).Cells.Item(1, 1); $c.Formula = $formulaOrText
  $c.Font.Size = 16; $ws.Rows(1).RowHeight = 32; $rg.VerticalAlignment = -4108
}
function Card($ws, $lbl, $val, $text, $formula, $dark, $tint) {
  $l = $ws.Range($lbl); $v = $ws.Range($val)
  if ($l.Cells.Count -gt 1) { $l.Merge() }; if ($v.Cells.Count -gt 1) { $v.Merge() }
  $l.Cells.Item(1,1).Value2 = $text; $v.Cells.Item(1,1).Formula = $formula
  Band $l $dark $WHITE; $l.Font.Size = 9; $l.HorizontalAlignment = -4108; $l.WrapText = $true
  $v.Interior.Color = $tint; $v.Font.Color = $dark; $v.Font.Bold = $true; $v.Font.Size = 14
  $v.HorizontalAlignment = -4108; $v.VerticalAlignment = -4108; $v.NumberFormatLocal = $MON
  $o = $ws.Range($l.Cells.Item(1,1), $v.Cells.Item($v.Rows.Count, $v.Columns.Count))
  foreach ($e in 7,8,9,10) { $b = $o.Borders.Item($e); $b.LineStyle = 1; $b.Weight = -4138; $b.Color = $dark }
}
function HomeLink($ws, $addr) {
  $c = $ws.Range($addr)
  $ws.Hyperlinks.Add($c, "", "'Inicio'!A1", "Volver al menú", "⌂ Inicio") | Out-Null
  Band $c $NAVY $WHITE; $c.Font.Underline = -4142; $c.HorizontalAlignment = -4108; $c.Font.Size = 10
}
function Finish($ws, $zoom, $freezeCell) {
  $ws.Activate(); $w = $x.ActiveWindow
  $w.FreezePanes = $false; $w.SplitRow = 0; $w.SplitColumn = 0
  $w.DisplayGridlines = $false; $w.Zoom = $zoom
  if ($freezeCell) { $w.ScrollRow = 1; $w.ScrollColumn = 1; $ws.Range($freezeCell).Select() | Out-Null; $w.FreezePanes = $true }
  $ws.Range("A1").Select() | Out-Null
  try { $p = $ws.PageSetup; $p.Orientation = 2; $p.Zoom = $false; $p.FitToPagesWide = 1; $p.FitToPagesTall = $false; $p.CenterHorizontally = $true } catch {}
}

# =================== INICIO ===================
$i = $wb.Worksheets.Item("Inicio")
$i.Rows("3:9").Insert() | Out-Null
$i.Range("A3:C9").ClearFormats() | Out-Null
$i.Cells.Font.Name = "Arial"
Title $i "B1" "CONTROL DE BOLETOS — TDS · PIN · PKS"
$i.Range("B2").Font.Color = $DARKTXT; $i.Range("B2").Font.Italic = $true
$i.Range("B4").Value2 = "MENÚ — haz clic en una opción para ir a esa hoja"
$i.Range("B4").Font.Bold = $true; $i.Range("B4").Font.Color = $NAVY; $i.Range("B4").Font.Size = 11
$menu = @(
  @("Registro",       "✎  REGISTRO — anotar un viaje nuevo o corregir uno", $ORANGE),
  @("Consulta",       "🔎  CONSULTA — ver los viajes de un bus en un mes", $BLUE),
  @("Resumen",        "📅  RESUMEN — totales de cada mes del año", $GREEN),
  @("Resumen diario", "📊  RESUMEN DIARIO — cada día del mes de un bus", $NAVY))
for ($k = 0; $k -lt $menu.Count; $k++) {
  $c = $i.Range("B$(5 + $k)")
  $i.Hyperlinks.Add($c, "", "'$($menu[$k][0])'!A1", "Ir a $($menu[$k][0])", $menu[$k][1]) | Out-Null
  Band $c $menu[$k][2] $WHITE; $c.Font.Size = 12; $c.Font.Underline = -4142; $c.IndentLevel = 1
  $c.VerticalAlignment = -4108; $c.WrapText = $false; $i.Rows(5 + $k).RowHeight = 26
  $c.Borders.Item(9).LineStyle = 1; $c.Borders.Item(9).Color = $WHITE; $c.Borders.Item(9).Weight = -4138
}
$i.Range("B9").Value2 = "Las celdas amarillas son las que tú escribes o eliges; todo lo demás se calcula solo."
$i.Range("B9").Font.Italic = $true; $i.Range("B9").Font.Color = $DARKTXT
for ($row = 10; $row -le 40; $row++) {
  $c = $i.Range("B$row"); $t = [string]$c.Value2
  if ($t -match '^\d\. ') { Band $c $NAVYt $NAVY; $c.Font.Size = 11; $i.Rows($row).RowHeight = 22; $c.VerticalAlignment = -4108; $c.IndentLevel = 1 }
  elseif ($t -ne "") { $c.IndentLevel = 1; $c.Font.Color = $DARKTXT }
}
$i.Columns("A").ColumnWidth = 3
$i.Tab.Color = $NAVY
Finish $i 100 $null

# =================== REGISTRO ===================
$g = $wb.Worksheets.Item("Registro")
$h = $g.Range("A1:K1"); Band $h $NAVY $WHITE; $h.HorizontalAlignment = -4108; $h.VerticalAlignment = -4108
Band $g.Range("F1") $ORANGE $WHITE
$g.Rows(1).RowHeight = 36
Box $g.Range("A1:K1001")
$g.Range("A1:K1001").AutoFilter() | Out-Null
HomeLink $g "M1"; $g.Columns("M").ColumnWidth = 12
$g.Tab.Color = $ORANGE
Finish $g 100 "C2"

# =================== CONSULTA ===================
$c = $wb.Worksheets.Item("Consulta")
$c.Range("A1:U1").Interior.Color = $NAVY
Title $c "A1:U1" '="CONSULTA — "&$B$3&" · "&$F$3&" "&$D$3'
$c.Range("A1:U1").HorizontalAlignment = -4131
$c.Range("A2").Font.Italic = $true; $c.Range("A2").Font.Color = $DARKTXT
foreach ($a in "B3","D3","F3") { $c.Range($a).Font.Size = 12 }
$c.Rows(3).RowHeight = 24; $c.Rows(4).RowHeight = 30
HomeLink $c "I3"
Card $c "J3:K3" "J4:K4" "MONTO IDA (normal)" "=G7" $BLUE $BLUEt
Card $c "L3:M3" "L4:M4" "DESCUENTO" "=H7" $BLUE $BLUEt
Card $c "N3:O3" "N4:O4" "IDA NETO" "=I7" $BLUE $BLUEt
Card $c "P3:Q3" "P4:Q4" "MONTO LLEGADA" "=N7" $GREEN $GREENt
Card $c "R3:S3" "R4:S4" "GASTOS + OTROS" "=P7+S7" $ORANGE $ORANGEt
Card $c "T3:U3" "T4:U4" "NETO FINAL" "=T7" $NAVY $NAVYt
Band $c.Range("A5:D5") $NAVY $WHITE
Band $c.Range("E5:I5") $BLUE $WHITE
Band $c.Range("J5:N5") $GREEN $WHITE
Band $c.Range("O5:T5") $ORANGE $WHITE
Band $c.Range("U5") $NAVY $WHITE
$c.Range("A6:D6").Interior.Color = $NAVYt; $c.Range("E6:I6").Interior.Color = $BLUEt
$c.Range("J6:N6").Interior.Color = $GREENt; $c.Range("O6:T6").Interior.Color = $ORANGEt; $c.Range("U6").Interior.Color = $NAVYt
$c.Range("A6:U6").VerticalAlignment = -4108
$c.Range("A7:U7").Font.Size = 11; $c.Rows(7).RowHeight = 20
for ($row = 8; $row -le 69; $row += 2) { $c.Range("A$($row):U$($row)").Interior.Color = $GREY }
foreach ($col in "G","H","I","L","N","P","Q","S","T") { $c.Range("$($col)7:$($col)69").NumberFormatLocal = $MON }
$c.Range("I7:I69").Font.Bold = $true; $c.Range("I7:I69").Font.Color = $BLUE
$c.Range("T7:T69").Font.Bold = $true
Box $c.Range("A5:U69")
$c.Tab.Color = $BLUE
Finish $c 90 "A8"

# =================== RESUMEN (año) ===================
$r = $wb.Worksheets.Item("Resumen")
Title $r "A1:AF1" '="RESUMEN DEL AÑO "&$B$3&" — POR MES Y BUS"'
$r.Range("A2").Font.Italic = $true; $r.Range("A2").Font.Color = $DARKTXT; $r.Range("A2").WrapText = $false
$r.Range("B3").Font.Size = 12; $r.Rows(3).RowHeight = 22
HomeLink $r "D3"
Box $r.Range("A5:AF19")
$blocks = @(@("C","J",$BLUE,$BLUEt), @("K","R",$GREEN,$GREENt), @("S","Z",$ORANGE,$ORANGEt), @("AA","AF",$NAVY,$NAVYt))
foreach ($b in $blocks) {
  Band $r.Range("$($b[0])5:$($b[1])5") $b[2] $WHITE
  $r.Range("$($b[0])6:$($b[1])6").Interior.Color = $b[3]
  $r.Range("$($b[0])5:$($b[1])19").Borders.Item(7).Weight = -4138
}
$r.Range("A5:B6").Interior.Color = $NAVYt
$r.Rows(5).RowHeight = 20; $r.Range("A6:AF6").WrapText = $true; $r.Rows(6).RowHeight = 28; $r.Range("A6:AF6").VerticalAlignment = -4108
for ($row = 8; $row -le 18; $row += 2) { $r.Range("A$($row):AF$($row)").Interior.Color = $GREY }
foreach ($col in "E","F","G","H","I","J","M","N","O","P","Q","R","U","V","W","X","Y","Z","AB","AC","AD","AE","AF") { $r.Range("$($col)7:$($col)19").NumberFormatLocal = $MON }
foreach ($col in "G","O","W","AD") { $r.Range("$($col)7:$($col)19").Font.Bold = $true; $r.Range("$($col)7:$($col)19").Font.Color = $BLUE }
foreach ($col in "J","R","Z","AF") { $r.Range("$($col)7:$($col)19").Font.Bold = $true }
$t = $r.Range("A19:AF19"); $t.Interior.Color = $NAVYt; $t.Font.Bold = $true; $t.Font.Size = 11; $r.Rows(19).RowHeight = 22
$t.Borders.Item(8).LineStyle = 1; $t.Borders.Item(8).Weight = -4138; $t.Borders.Item(8).Color = $NAVY
$r.Range("B7:B18").Font.Bold = $true
# gráficos anuales
$top = $r.Range("A22").Top; $left = $r.Range("B22").Left
$r.Range("B21").Value2 = "GRÁFICOS DEL AÑO"; $r.Range("B21").Font.Bold = $true; $r.Range("B21").Font.Color = $NAVY; $r.Range("B21").Font.Size = 12
$specs = @(@("Ida neto por mes", @("G","O","W")), @("Neto final por mes", @("J","R","Z")))
$cw = 520; $chh = 300
for ($q = 0; $q -lt 2; $q++) {
  $co = $r.ChartObjects().Add($left + $q * ($cw + 20), $top, $cw, $chh); $ch = $co.Chart
  $ch.ChartType = 51
  while ($ch.SeriesCollection().Count -gt 0) { $ch.SeriesCollection(1).Delete() }
  $names = @("TDS","PIN","PKS"); $cols = @($BLUE,$GREEN,$ORANGE)
  for ($s = 0; $s -lt 3; $s++) {
    $se = $ch.SeriesCollection().NewSeries(); $col = $specs[$q][1][$s]
    $se.Values = $r.Range("$($col)7:$($col)18"); $se.XValues = $r.Range("B7:B18"); $se.Name = $names[$s]
    $se.Format.Fill.ForeColor.RGB = $cols[$s]
  }
  $ch.HasTitle = $true; $ch.ChartTitle.Text = $specs[$q][0]; $ch.HasLegend = $true; $ch.Legend.Position = -4107
}
$r.Tab.Color = $GREEN
Finish $r 90 "C7"

# =================== RESUMEN DIARIO ===================
$d = $wb.Worksheets.Item("Resumen diario")
$d.Rows("4:6").Insert() | Out-Null
$d.Range("A4:J6").ClearFormats() | Out-Null
$d.Range("A4:J6").Font.Name = "Arial"
# filas ahora: 3 selectores, 5-6 tarjetas, 8 grupos, 9 encabezados, 10 total, 11-41 días
$d.Range("A1:J1").Interior.Color = $NAVY
Title $d "A1:J1" '="RESUMEN DIARIO — "&$B$3&" · "&$F$3&" "&$D$3'
$d.Range("A2").Font.Italic = $true; $d.Range("A2").Font.Color = $DARKTXT
foreach ($a in "B3","D3","F3") { $d.Range($a).Font.Size = 12 }
$d.Rows(3).RowHeight = 24
$d.Range("G3:H3").Font.Color = $LINE   # número de mes: solo ayuda
HomeLink $d "J3"
$d.Rows(4).RowHeight = 6; $d.Rows(5).RowHeight = 26; $d.Rows(6).RowHeight = 30; $d.Rows(7).RowHeight = 8
Card $d "A5:C5" "A6:C6" "VIAJES DEL MES" "=C10" $NAVY $NAVYt
$d.Range("A6").NumberFormatLocal = "0"
Card $d "D5" "D6" "IDA NORMAL" "=D10" $BLUE $BLUEt
Card $d "E5" "E6" "DESCUENTO" "=E10" $BLUE $BLUEt
Card $d "F5" "F6" "IDA NETO" "=F10" $BLUE $BLUEt
Card $d "G5" "G6" "LLEGADA NORMAL" "=G10" $GREEN $GREENt
Card $d "H5" "H6" "GASTOS" "=H10" $ORANGE $ORANGEt
Card $d "I5" "I6" "OTROS GASTOS" "=I10" $ORANGE $ORANGEt
Card $d "J5" "J6" "LLEGADA NETA" "=J10" $GREEN $GREENt
$d.Range("D6:J6").Font.Size = 12
Band $d.Range("A8:C8") $NAVY $WHITE
Band $d.Range("D8:F8") $BLUE $WHITE
Band $d.Range("G8:J8") $GREEN $WHITE
$d.Range("A9:C9").Interior.Color = $NAVYt; $d.Range("D9:F9").Interior.Color = $BLUEt; $d.Range("G9:J9").Interior.Color = $GREENt
$d.Range("H9:I9").Interior.Color = $ORANGEt
$t = $d.Range("A10:J10"); $t.Interior.Color = $NAVYt; $t.Font.Size = 11; $d.Rows(10).RowHeight = 20
$t.Borders.Item(9).LineStyle = 1; $t.Borders.Item(9).Weight = -4138; $t.Borders.Item(9).Color = $NAVY
$d.Range("A10:J41").Interior.ColorIndex = -4142
$t.Interior.Color = $NAVYt
for ($row = 12; $row -le 41; $row += 2) { $d.Range("A$($row):J$($row)").Interior.Color = $GREY }
$d.Range("D10:J41").NumberFormatLocal = $MONZ
$d.Range("F10:F41").Font.Color = $BLUE; $d.Range("F10:F41").Font.Bold = $true
$d.Range("J10:J41").Font.Bold = $true
Box $d.Range("A8:J41")
# fines de semana en gris azulado (formato condicional)
$wk = $null
foreach ($fm in @('=Y($A11<>"";DIASEM($A11;2)>5)', '=AND($A11<>"",WEEKDAY($A11,2)>5)')) {
  try { $d.Range("A11:B41").Select() | Out-Null; $wk = $d.Range("A11:B41").FormatConditions.Add(2, [Type]::Missing, $fm); break } catch {}
}
if ($wk) { $wk.Font.Color = $BLUE; $wk.Font.Bold = $true }
# gráfico diario
$co = $d.ChartObjects().Add($d.Range("L5").Left, $d.Range("L5").Top, 620, 380); $ch = $co.Chart
$ch.ChartType = 51
while ($ch.SeriesCollection().Count -gt 0) { $ch.SeriesCollection(1).Delete() }
$s1 = $ch.SeriesCollection().NewSeries(); $s1.Values = $d.Range("F11:F41"); $s1.XValues = $d.Range("A11:A41"); $s1.Name = "Ida neto"; $s1.Format.Fill.ForeColor.RGB = $BLUE
$s2 = $ch.SeriesCollection().NewSeries(); $s2.Values = $d.Range("J11:J41"); $s2.XValues = $d.Range("A11:A41"); $s2.Name = "Llegada neta"; $s2.Format.Fill.ForeColor.RGB = $GREEN
$ax = $ch.Axes(1); $ax.CategoryType = 2; $ax.TickLabels.NumberFormatLocal = "dd"
$ch.HasTitle = $true; $ch.ChartTitle.Text = "Ida neto y llegada neta por día"; $ch.HasLegend = $true; $ch.Legend.Position = -4107
$d.Columns("K").ColumnWidth = 2
$d.Tab.Color = $NAVY
Finish $d 100 "A11"

$wb.Worksheets.Item("Inicio").Activate()
$x.Calculation = -4105
$wb.SaveAs($dst, 51)
"OK MON=$MON weekendCF=$([bool]$wk)"
} finally {
  $wb.Close($false); $x.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($x) | Out-Null
}
