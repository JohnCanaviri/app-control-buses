param([string]$src, [string]$dst)
$ErrorActionPreference = "Stop"
function RGB($r, $g, $b) { $r + $g * 256 + $b * 65536 }
$NAVY = RGB 31 56 100;   $NAVYt = RGB 214 220 228
$BLUE = RGB 46 117 182;  $BLUEt = RGB 221 235 247
$GREEN = RGB 84 130 53;  $GREENt = RGB 226 239 218
$ORANGE = RGB 197 90 17; $ORANGEt = RGB 252 228 214
$PURPLE = RGB 112 48 160; $PURPLEt = RGB 234 224 244
$GREY = RGB 242 242 242; $LINE = RGB 191 191 191; $WHITE = RGB 255 255 255; $DARKTXT = RGB 64 64 64
$MON = "#.##0,00;[Rojo]-#.##0,00"
$LAST = 515

$x = New-Object -ComObject Excel.Application; $x.Visible = $false; $x.DisplayAlerts = $false
$wb = $x.Workbooks.Open($src)
try {
function Band($rg, $fill, $font) { $rg.Interior.Color = $fill; $rg.Font.Color = $font; $rg.Font.Bold = $true }
function Box($rg) { foreach ($e in 7,8,9,10,11,12) { try { $b = $rg.Borders.Item($e); $b.LineStyle = 1; $b.Weight = 2; $b.Color = $LINE } catch {} } }
function Card($ws, $lbl, $val, $text, $formula, $dark, $tint) {
  $l = $ws.Range($lbl); $v = $ws.Range($val); $l.Merge(); $v.Merge()
  $l.Cells.Item(1,1).Value2 = $text; $v.Cells.Item(1,1).Formula = $formula
  Band $l $dark $WHITE; $l.HorizontalAlignment = -4108; $l.VerticalAlignment = -4108
  $v.Interior.Color = $tint; $v.Font.Color = $dark; $v.Font.Bold = $true; $v.Font.Size = 18
  $v.HorizontalAlignment = -4108; $v.VerticalAlignment = -4108; $v.NumberFormatLocal = $MON
  $o = $ws.Range($l.Cells.Item(1,1), $v.Cells.Item($v.Rows.Count, $v.Columns.Count))
  foreach ($e in 7,8,9,10) { $b = $o.Borders.Item($e); $b.LineStyle = 1; $b.Weight = -4138; $b.Color = $dark }
}

$g = $wb.Worksheets.Item("Registro")
$cons = $wb.Worksheets.Item("Consulta")
$s = $wb.Worksheets.Add([Type]::Missing, $wb.Worksheets.Item("Resumen diario"))
$s.Name = "Facturas"
$s.Cells.Font.Name = "Arial"; $s.Cells.Font.Size = 10
foreach ($p in @(@("A",11),@("B",13),@("C",30),@("D",30),@("E",16),@("F",16),@("G",11),@("H",22))) { $s.Columns($p[0]).ColumnWidth = $p[1] }

# --- título y selectores ---
$t = $s.Range("A1:H1"); Band $t $NAVY $WHITE; $s.Rows(1).RowHeight = 32; $t.VerticalAlignment = -4108
$s.Range("A1").Formula = '="FACTURAS E IVA — "&$D$3&" "&$B$3&" (todos los buses)"'; $s.Range("A1").Font.Size = 16
$s.Range("A2").Value2 = "Anota abajo cada factura que conseguiste (fecha y monto). Arriba eliges año y mes: se compara el IVA de las ventas del mes (Ida neto + Llegada normal de los 3 buses) con el IVA de las facturas de ese mes."
$s.Range("A2").Font.Italic = $true; $s.Range("A2").Font.Color = $DARKTXT
$s.Range("A3").Value2 = "Año:";  $s.Range("B3").Value2 = 2026
$s.Range("C3").Value2 = "Mes:";  $s.Range("D3").Value2 = "Octubre"
$s.Range("E3").Value2 = "Tasa IVA:"; $s.Range("F3").Value2 = 0.13
$s.Range("G3").Formula = '=$B$3*100+MATCH($D$3,{"Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"},0)'
$s.Range("G3").Font.Color = $LINE; $s.Range("G3").Font.Size = 8
foreach ($a in "A3","C3","E3") { $s.Range($a).Font.Bold = $true; $s.Range($a).HorizontalAlignment = -4152 }
$inC = 14416383; $inF = 16711680   # amarillo de entrada y letra azul, como en Registro
foreach ($a in "B3","D3","F3") { $rg = $s.Range($a); $rg.Interior.Color = $inC; $rg.Font.Color = $inF; $rg.Font.Bold = $true; $rg.Font.Size = 12; $rg.HorizontalAlignment = -4108 }
$s.Range("D3").HorizontalAlignment = -4108
$s.Range("F3").NumberFormatLocal = "0%"
$s.Range("B3").Validation.Add(1, 1, 1, "2000", "2100") | Out-Null
$s.Range("D3").Validation.Add(3, 1, 1, $cons.Range("F3").Validation.Formula1) | Out-Null
$s.Range("F3").Validation.Add(2, 1, 1, "0", "1") | Out-Null
$s.Rows(3).RowHeight = 24
$h = $s.Range("H3"); $s.Hyperlinks.Add($h, "", "'Inicio'!A1", "Volver al menú", "⌂ Inicio") | Out-Null
Band $h $NAVY $WHITE; $h.Font.Underline = -4142; $h.HorizontalAlignment = -4108

# --- comparación del mes ---
$ini = 'DATE($B$3,MOD($G$3,100),1)'
$fin = 'EOMONTH(DATE($B$3,MOD($G$3,100),1),0)'
$rngA = "`$A`$16:`$A`$$LAST"; $rngE = "`$E`$16:`$E`$$LAST"
$s.Range("A5:F5").Merge(); $s.Range("A5").Value2 = "COMPARACIÓN DEL MES"; Band $s.Range("A5:F5") $NAVY $WHITE; $s.Range("A5").HorizontalAlignment = -4108
$s.Range("A6:D6").Merge(); $s.Range("A6").Value2 = "Concepto"; $s.Range("E6").Value2 = "Monto"; $s.Range("F6").Formula = '="IVA ("&TEXT($F$3*100,"0")&"%)"'
$hd = $s.Range("A6:F6"); $hd.Interior.Color = $NAVYt; $hd.Font.Bold = $true; $hd.HorizontalAlignment = -4108
$rows = @(
  @(7,  "Ida neto del mes (3 buses)",  'SUMIFS(Cálculo!$G$2:$G$1001,Cálculo!$C$2:$C$1001,$G$3)', $BLUEt, $BLUE),
  @(8,  "Llegada normal del mes (3 buses)", 'SUMIFS(Registro!$H$2:$H$1001,Cálculo!$C$2:$C$1001,$G$3)', $GREENt, $GREEN),
  @(9,  "TOTAL VENTAS  →  IVA débito", '=E7+E8', $NAVYt, $NAVY),
  @(10, "", "SUMIFS($rngE,$rngA,`">=`"&$ini,$rngA,`"<=`"&$fin)", $PURPLEt, $PURPLE),
  @(11, "Diferencia (ventas − facturas)", '=E9-E10', $GREY, $DARKTXT))
foreach ($q in $rows) {
  $n = $q[0]; $s.Range("A$($n):D$($n)").Merge()
  $s.Range("A$n").Value2 = $q[1]; $f = $q[2]; if (-not $f.StartsWith("=")) { $f = "=" + $f }
  $s.Range("E$n").Formula = $f
  $s.Range("F$n").Formula = if ($n -eq 11) { "=F9-F10" } elseif ($n -eq 9) { "=F7+F8" } else { "=E$n*`$F`$3" }
  $rg = $s.Range("A$($n):F$($n)"); $rg.Interior.Color = $q[3]; $s.Range("A$n").Font.Color = $q[4]; $s.Range("A$n").Font.Bold = $true; $s.Range("A$n").IndentLevel = 1
  $s.Rows($n).RowHeight = 22; $rg.VerticalAlignment = -4108
}
$s.Range("A10").Formula = "=`"Facturas del mes (`"&COUNTIFS($rngA,`">=`"&$ini,$rngA,`"<=`"&$fin)&`")  →  IVA crédito`""
$s.Range("E7:F11").NumberFormatLocal = $MON; $s.Range("E7:F11").Font.Size = 11
$s.Range("A9:F9").Font.Bold = $true; $s.Range("F9:F10").Font.Bold = $true
Box $s.Range("A5:F11")
$s.Range("A9:F9").Borders.Item(8).Weight = -4138; $s.Range("A9:F9").Borders.Item(8).Color = $NAVY
Card $s "G5:H5" "G6:H8" "IVA A PAGAR" '=MAX(F9-F10,0)' $ORANGE $ORANGEt
Card $s "G9:H9" "G10:H11" "SALDO A FAVOR (crédito)" '=MAX(F10-F9,0)' $GREEN $GREENt
$s.Range("G10").Font.Size = 14

# --- registro de facturas ---
$s.Rows(13).RowHeight = 8
$s.Range("A14:H14").Merge(); $s.Range("A14").Value2 = "REGISTRO DE FACTURAS — una por fila (puedes anotar las de todos los meses; ✓ marca las del mes elegido)"
Band $s.Range("A14:H14") $PURPLE $WHITE; $s.Range("A14").HorizontalAlignment = -4108; $s.Rows(14).RowHeight = 20
$hdr = @("Fecha","N° factura","Proveedor / NIT","Concepto","Monto factura","IVA (crédito)","¿Del mes?","Observaciones")
for ($k = 0; $k -lt 8; $k++) { $s.Cells.Item(15, $k + 1).Value2 = $hdr[$k] }
$hd = $s.Range("A15:H15"); $hd.Interior.Color = $PURPLEt; $hd.Font.Bold = $true; $hd.HorizontalAlignment = -4108; $hd.VerticalAlignment = -4108; $s.Rows(15).RowHeight = 22
foreach ($a in "A16:E$LAST","H16:H$LAST") { $inp = $s.Range($a); $inp.Interior.Color = $inC; $inp.Font.Color = $inF }
$s.Range("A16:A$LAST").NumberFormat = $g.Range("B2").NumberFormat; $s.Range("A16:A$LAST").HorizontalAlignment = -4108
$s.Range("B16:B$LAST").NumberFormat = "@"
$s.Range("E16:F$LAST").NumberFormatLocal = $MON
$s.Range("F16:F$LAST").Formula = '=IF(E16="","",E16*$F$3)'
$s.Range("G16:G$LAST").Formula = '=IF(AND(ISNUMBER(A16),E16<>""),IF(YEAR(A16)*100+MONTH(A16)=$G$3,"✓",""),"")'
$s.Range("G16:G$LAST").HorizontalAlignment = -4108; $s.Range("G16:G$LAST").Font.Bold = $true; $s.Range("G16:G$LAST").Font.Color = $GREEN; $s.Range("G16:G$LAST").Font.Size = 12
$s.Range("F16:F$LAST").Font.Color = $PURPLE
$s.Range("A16:A$LAST").Validation.Add(4, 1, 7, "36526") | Out-Null
$s.Range("A16:A$LAST").Validation.ErrorMessage = "Escribe una fecha, por ejemplo 24-10-26."
$s.Range("E16:E$LAST").Validation.Add(2, 1, 7, "0") | Out-Null
$s.Range("E16:E$LAST").Validation.ErrorMessage = "Escribe solo el monto de la factura (número)."
Box $s.Range("A15:H$LAST")
$s.Range("A15:H$LAST").AutoFilter() | Out-Null

$s.Tab.Color = $PURPLE
$s.Activate(); $w = $x.ActiveWindow; $w.DisplayGridlines = $false; $w.Zoom = 100
$s.Range("A16").Select() | Out-Null; $w.ScrollRow = 1
try { $p = $s.PageSetup; $p.Orientation = 2; $p.Zoom = $false; $p.FitToPagesWide = 1; $p.FitToPagesTall = $false } catch {}

# --- Inicio: botón y explicación ---
$i = $wb.Worksheets.Item("Inicio")
$i.Rows(9).Insert() | Out-Null
$c = $i.Range("B9")
$i.Hyperlinks.Add($c, "", "'Facturas'!A1", "Ir a Facturas", "🧾  FACTURAS — registrar facturas y calcular el IVA del mes") | Out-Null
Band $c $PURPLE $WHITE; $c.Font.Size = 12; $c.Font.Underline = -4142; $c.IndentLevel = 1; $c.VerticalAlignment = -4108; $c.Font.Italic = $false
$i.Rows(9).RowHeight = 26
$c.Borders.Item(9).LineStyle = 1; $c.Borders.Item(9).Color = $WHITE; $c.Borders.Item(9).Weight = -4138
$lastTxt = 0; for ($row = 10; $row -le 60; $row++) { if ([string]$i.Range("B$row").Value2 -ne "") { $lastTxt = $row } }
$cal = 0; for ($row = 10; $row -le 60; $row++) { if (([string]$i.Range("B$row").Value2).StartsWith("Cálculo:")) { $cal = $row } }
$i.Rows($cal).Insert() | Out-Null
$i.Range("B$cal").Value2 = "Facturas: anota cada factura (fecha, número, proveedor, monto). Elige año y mes arriba: IVA débito = tasa × (Ida neto + Llegada normal de los 3 buses); IVA crédito = tasa × total de facturas del mes; IVA a pagar = débito − crédito (si sale negativo, es saldo a favor). La tasa (13%) se puede cambiar."
$i.Range("B$cal").Font.Bold = $false; $i.Range("B$cal").Interior.ColorIndex = -4142; $i.Range("B$cal").Font.Color = $DARKTXT; $i.Range("B$cal").IndentLevel = 1; $i.Range("B$cal").WrapText = $true
$i.Rows($cal).AutoFit() | Out-Null
$i.Activate(); $i.Range("A1").Select() | Out-Null

$wb.SaveAs($dst, 51)
"OK"
} finally { $wb.Close($false); $x.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($x) | Out-Null }
