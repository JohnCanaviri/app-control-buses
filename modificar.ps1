param([string]$src, [string]$dst)
$ErrorActionPreference = "Stop"
$x = New-Object -ComObject Excel.Application; $x.Visible = $false; $x.DisplayAlerts = $false
$wb = $x.Workbooks.Open($src)
$x.Calculation = -4135  # manual mientras se edita
try {
$NF = "#,##0.00"
$NFZ = '#,##0.00;-#,##0.00;"-"'

# ---------- 1. Registro: columna Descuento después de Boletos de ida ----------
$g = $wb.Worksheets.Item("Registro")
$g.Columns("F").Insert(-4161, 0) | Out-Null
$g.Range("H1:H1001").Copy() | Out-Null
$g.Range("F1:F1001").PasteSpecial(-4122) | Out-Null
$g.Range("F1").Value2 = "Descuento ida (monto)"
$g.Range("F2:F1001").NumberFormat = $NF
$g.Columns("F").ColumnWidth = 14
$v = $g.Range("F2:F1001").Validation
$v.Delete()
$v.Add(2, 1, 7, "0") | Out-Null   # decimal >= 0
$v.ErrorMessage = "Escribe solo el monto del descuento (número mayor o igual a 0)."
$v.InputMessage = "Monto que se resta solo al monto de ida."

# ---------- 2. Cálculo: Descuento ida y Monto ida neto ----------
$k = $wb.Worksheets.Item("Cálculo")
$k.Columns("F:G").Insert(-4161, 0) | Out-Null
$k.Range("F1").Value2 = "Descuento ida"
$k.Range("G1").Value2 = "Monto ida neto"
$k.Range("F2:F1001").Formula = '=IF(Registro!$F2="","",N(Registro!$F2))'
$k.Range("G2:G1001").Formula = '=IF(AND(E2="",F2=""),"",IF(OR(E2="",ISNUMBER(E2)),N(E2)-N(F2),E2))'
$k.Range("F2:G1001").NumberFormat = $NF
# Columnas Cálculo ahora: E ida, F desc, G ida neto, K gastos, L otros, N neto final

# ---------- 3. Consulta: Descuento y Monto ida neto en el bloque IDA ----------
$c = $wb.Worksheets.Item("Consulta")
$c.Range("E5:G5").UnMerge()
$c.Columns("H:I").Insert(-4161, 0) | Out-Null
$c.Range("E5:I5").Merge()
$c.Range("E5").Value2 = "IDA"
$c.Range("J3").Cut($c.Range("H3")) | Out-Null   # la clave vuelve junto a su etiqueta
$c.Range("H6").Value2 = "Descuento ida"
$c.Range("I6").Value2 = "Monto ida neto"
$c.Range("H7").Formula = "=SUM(H8:H69)"
$c.Range("I7").Formula = "=SUM(I8:I69)"
$c.Range("H8:H69").Formula = '=IF($A8="","",IF(INDEX(Cálculo!$F$1:$F$1001,$A8)="","",INDEX(Cálculo!$F$1:$F$1001,$A8)))'
$c.Range("I8:I69").Formula = '=IF($A8="","",IF(INDEX(Cálculo!$G$1:$G$1001,$A8)="","",INDEX(Cálculo!$G$1:$G$1001,$A8)))'
$c.Columns("H:I").ColumnWidth = 12.29

# ---------- 4. Resumen (anual): Descuento e Ida neto por bus y total ----------
$r = $wb.Worksheets.Item("Resumen")
$crit = 'Cálculo!$A$2:$A$1001,{0}$5,Cálculo!$C$2:$C$1001,$B$3*100+$A{1}'
# bloques: [col inserción, col ancla bus, col monto ida]
foreach ($b in @(@("F","C","E"), @("N","K","M"), @("V","S","U"))) {
  $ins = $b[0]; $anc = $b[1]; $ida = $b[2]
  $d = $ins; $n = [char]([int][char]$ins + 1)
  $r.Columns("$($d):$($n)").Insert(-4161, 0) | Out-Null
  $r.Range("$($d)6").Value2 = "Descuento"
  $r.Range("$($n)6").Value2 = "Ida neto"
  for ($row = 7; $row -le 18; $row++) {
    $r.Range("$d$row").Formula = "=SUMIFS(Cálculo!`$F`$2:`$F`$1001," + ($crit -f $anc, $row) + ")"
    $r.Range("$n$row").Formula = "=$ida$row-$d$row"
  }
  $r.Range("$($d)19").Formula = "=SUM($($d)7:$($d)18)"
  $r.Range("$($n)19").Formula = "=SUM($($n)7:$($n)18)"
}
# Todos los buses: AA viajes, AB ida -> insertar AC, AD
$r.Columns("AC:AD").Insert(-4161, 0) | Out-Null
$r.Range("AC6").Value2 = "Descuento"
$r.Range("AD6").Value2 = "Ida neto"
for ($row = 7; $row -le 18; $row++) {
  $r.Range("AC$row").Formula = "=F$row+N$row+V$row"
  $r.Range("AD$row").Formula = "=G$row+O$row+W$row"
}
$r.Range("AC19").Formula = "=SUM(AC7:AC18)"
$r.Range("AD19").Formula = "=SUM(AD7:AD18)"
$r.Range("A2").Value2 = "Cambia el año en la celda amarilla. Todo se calcula solo a partir de la hoja Registro. Monto ida = total de los boletos de ida. Descuento = descuentos registrados (solo afectan a la ida). Ida neto = Monto ida − Descuento. Monto llegada = monto registrado que trajeron. Neto final = monto llegada − gastos − otros gastos. Ida y llegada van separados."

# ---------- 5. Nueva hoja: Resumen diario (un bus, un mes, día por día) ----------
$colInfo = $c.Range("A5").Interior.Color
$colIda  = $c.Range("E5").Interior.Color
$colLleg = $c.Range("J5").Interior.Color
$colHdr  = $c.Range("A6").Interior.Color
$colTot  = $c.Range("B7").Interior.Color
$colIn   = $c.Range("B3").Interior.Color
$fontIn  = $c.Range("B3").Font.Color

$s = $wb.Worksheets.Add([Type]::Missing, $r)
$s.Name = "Resumen diario"
$s.Cells.Font.Name = "Arial"; $s.Cells.Font.Size = 10
$s.Range("A1").Value2 = "RESUMEN DIARIO DEL MES POR BUS"
$s.Range("A1").Font.Size = 14; $s.Range("A1").Font.Bold = $true
$s.Range("A2").Value2 = "Elige el bus, el año y el mes (celdas amarillas). Se muestra cada día del mes con los montos de ida (normal y neto) y de llegada (normal y neto). Ida neto = Monto ida − Descuento. Llegada neta = Monto llegada − Gastos − Otros gastos."
$s.Range("A3").Value2 = "Bus:";  $s.Range("B3").Value2 = "TDS"
$s.Range("C3").Value2 = "Año:";  $s.Range("D3").Value2 = 2026
$s.Range("E3").Value2 = "Mes:";  $s.Range("F3").Value2 = "Octubre"
$s.Range("G3").Value2 = "Mes n°:"
$s.Range("H3").Formula = '=MATCH($F$3,{"Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"},0)'
foreach ($a in "A3","C3","E3","G3") { $s.Range($a).Font.Bold = $true; $s.Range($a).HorizontalAlignment = -4152 }
foreach ($a in "B3","D3","F3") { $rg = $s.Range($a); $rg.Interior.Color = $colIn; $rg.Font.Color = $fontIn; $rg.Font.Bold = $true; $rg.HorizontalAlignment = -4108 }
$s.Range("B3").Validation.Add(3, 1, 1, $c.Range("B3").Validation.Formula1) | Out-Null
$s.Range("D3").Validation.Add(1, 1, 1, "2000", "2100") | Out-Null
$s.Range("F3").Validation.Add(3, 1, 1, $c.Range("F3").Validation.Formula1) | Out-Null

$s.Range("A5:C5").Merge(); $s.Range("A5").Value2 = "DÍA"
$s.Range("D5:F5").Merge(); $s.Range("D5").Value2 = "IDA"
$s.Range("G5:J5").Merge(); $s.Range("G5").Value2 = "LLEGADA"
$s.Range("A5:C5").Interior.Color = $colInfo
$s.Range("D5:F5").Interior.Color = $colIda
$s.Range("G5:J5").Interior.Color = $colLleg
$s.Range("A5:J5").Font.Color = 16777215; $s.Range("A5:J5").Font.Bold = $true; $s.Range("A5:J5").HorizontalAlignment = -4108

$hdr = @("Fecha","Día","Viajes","Monto ida (normal)","Descuento","Monto ida neto","Monto llegada (normal)","Gastos","Otros gastos","Monto llegada neto")
for ($i = 0; $i -lt $hdr.Count; $i++) { $s.Cells.Item(6, $i + 1).Value2 = $hdr[$i] }
$h = $s.Range("A6:J6"); $h.Interior.Color = $colHdr; $h.Font.Bold = $true; $h.WrapText = $true; $h.HorizontalAlignment = -4108; $h.VerticalAlignment = -4108
$s.Rows(6).RowHeight = 27

$s.Range("A7").Value2 = "TOTAL MES"
$s.Range("C7:J7").Formula = "=SUM(C8:C38)"
$t = $s.Range("A7:J7"); $t.Interior.Color = $colTot; $t.Font.Bold = $true

$crit = 'Cálculo!$A$2:$A$1001,$B$3,Cálculo!$B$2:$B$1001,$A8'
$s.Range("A8:A38").Formula = '=IF(ROWS($A$8:$A8)<=DAY(EOMONTH(DATE($D$3,$H$3,1),0)),DATE($D$3,$H$3,ROWS($A$8:$A8)),"")'
$s.Range("B8:B38").Formula = '=IF($A8="","",CHOOSE(WEEKDAY($A8,2),"Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"))'
$s.Range("C8:C38").Formula = "=IF(`$A8=`"`",`"`",COUNTIFS($crit))"
$s.Range("D8:D38").Formula = "=IF(`$A8=`"`",`"`",SUMIFS(Cálculo!`$E`$2:`$E`$1001,$crit))"
$s.Range("E8:E38").Formula = "=IF(`$A8=`"`",`"`",SUMIFS(Cálculo!`$F`$2:`$F`$1001,$crit))"
$s.Range("F8:F38").Formula = '=IF($A8="","",D8-E8)'
$s.Range("G8:G38").Formula = "=IF(`$A8=`"`",`"`",SUMIFS(Registro!`$H`$2:`$H`$1001,$crit))"
$s.Range("H8:H38").Formula = "=IF(`$A8=`"`",`"`",SUMIFS(Cálculo!`$K`$2:`$K`$1001,$crit))"
$s.Range("I8:I38").Formula = "=IF(`$A8=`"`",`"`",SUMIFS(Cálculo!`$L`$2:`$L`$1001,$crit))"
$s.Range("J8:J38").Formula = "=IF(`$A8=`"`",`"`",SUMIFS(Cálculo!`$N`$2:`$N`$1001,$crit))"

$s.Range("A8:A38").NumberFormat = "dd-mm-yy"
$s.Range("C7:C38").NumberFormat = '0;-0;"-"'
$s.Range("D7:J38").NumberFormat = $NFZ
$s.Range("A7:C38").HorizontalAlignment = -4108
$s.Range("F7:F38").Font.Bold = $true; $s.Range("J7:J38").Font.Bold = $true
$bd = $s.Range("A5:J38").Borders
foreach ($e in 7,8,9,10,11,12) { $bd.Item($e).LineStyle = 1; $bd.Item($e).Weight = 2; $bd.Item($e).Color = 12566463 }
$s.Columns("A").ColumnWidth = 11; $s.Columns("B").ColumnWidth = 11; $s.Columns("C").ColumnWidth = 8
$s.Columns("D:J").ColumnWidth = 14
$s.Range("A2").WrapText = $false
$s.Activate()
$x.ActiveWindow.DisplayGridlines = $false
$s.Range("A8").Select() | Out-Null
$x.ActiveWindow.FreezePanes = $true

# ---------- 6. Inicio: instrucciones ----------
$i = $wb.Worksheets.Item("Inicio")
$i.Rows(13).Insert() | Out-Null
$i.Range("B13").Value2 = "Descuento ida (monto): si se hizo un descuento, escribe solo el monto (por ejemplo 50). Se resta únicamente al monto de ida: Monto ida neto = Monto ida − Descuento. No cambia la llegada ni el neto final. Si no hubo descuento, déjalo vacío."
$i.Range("B18").Value2 = "Consulta: elige bus, año y mes y verás esos viajes con todos los cálculos y los totales (incluye Descuento y Monto ida neto)."
$i.Range("B19").Value2 = "Resumen: totales de cada mes del año para cada bus y para todos juntos (incluye Descuento e Ida neto)."
$i.Rows(20).Insert() | Out-Null
$i.Range("B20").Value2 = "Resumen diario: elige bus, año y mes y verás cada día del mes con Monto ida (normal y neto), Descuento, Monto llegada (normal y neto), Gastos y Otros gastos, con el total del mes."

$x.Calculation = -4105
$wb.Worksheets.Item("Inicio").Activate()
$wb.SaveAs($dst, 51)
"OK"
} finally {
  $wb.Close($false); $x.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($x) | Out-Null
}
