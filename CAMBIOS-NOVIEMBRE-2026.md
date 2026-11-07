# Cambios de noviembre 2026

## Qué hacer una sola vez
1. **Supabase → SQL Editor:** pega y ejecuta `supabase/04_mejoras.sql`. Crea la tabla de ajustes, para que la tasa del IVA sea la misma en todos los equipos, y protege la cuenta del administrador. Hasta que lo ejecutes, la app sigue funcionando y cada equipo usa su propia tasa.
2. **Instalar:** en esta carpeta ejecuta `npm install` (o borra `node_modules` y abre «Abrir app.bat»). Ahora `xlsx` sale de `vendor/xlsx-0.20.3.tgz`, dentro del proyecto, y ya no hace falta cdn.sheetjs.com.
3. **Publicar:** sube los cambios a GitHub (rama `main`), incluida la carpeta `vendor/`. La publicación se hace sola.

## Correcciones
- **Respaldo:** «Agregar desde un respaldo» no borra nada. «Reemplazar todo» pide escribir REEMPLAZAR. El respaldo y el Excel completo ahora traen también los gastos del monto total (diésel, sueldos…).
- **Sincronización:** manda lo que está en internet, así los equipos ya no quedan con datos distintos. Ya no se saltan filas al bajar. Un cambio que el servidor rechaza ya no traba lo demás: se avisa y se deja lo que había en internet.
- **Diésel:** desde noviembre las vueltas se anotan siempre a mano (botón «⛽ Echar diésel» en Inicio) y el diésel ya no se puede anotar dentro de un viaje. Las cargas antiguas sin vueltas siguen usando los rangos de monto.
- **Facturas:** al importar del Excel, dos facturas iguales ya no se juntan en una. Si escaneas una factura ya registrada (mismo número y NIT), la app avisa.
- **Gastos:** la pestaña muestra también los gastos «General» (sin bus).
- **Tasa del IVA:** es una sola para toda la empresa y solo la cambia el administrador.
- **Sesión:** sin internet ya no se cierra por inactividad. Cerrar sesión cierra solo este equipo, sube lo pendiente y borra los datos del equipo.
- **Cuentas:** la gente pide su cuenta y solo entra cuando el administrador la aprueba.
- **Excel:** al reimportar un Excel corregido, los viajes se actualizan en lugar de duplicarse.
- **Fotos de facturas:** no suben a internet y se borran del equipo al día siguiente. El lector de QR y de texto es más preciso, y en las facturas electrónicas también lee la fecha y el monto.

## Nuevo
- **Inicio:** alerta en rojo «ECHAR DIÉSEL TDS / PIN / PKS» cuando al bus le queda 1 vuelta o menos, y en verde «Nos quedan N vueltas». Abajo, la llegada de cada bus: llegada neto − diésel − otros gastos = llegada final, con el total. Al final, el cuadro para anotar cuánto trajeron de la ida en los viajes «sin boletos de ida».
- **Viaje:** opción «Sin boletos de ida». El monto se puede dejar vacío y anotarlo a fin de mes.
- **Resúmenes:** pestañas «📊 Año» y «🖨 Informe del mes (imprimir)». El informe trae los viajes de cada bus al principio, la ida y la llegada por separado, cada bus por día con observaciones, los gastos del mes (el diésel primero) y la cuenta final de la llegada, con líneas para firmar. También se llega desde «Informe del mes» en Inicio.
- **Flechas ‹ ›:** para cambiar de bus, de mes y para pasar de un viaje o factura al anterior o al siguiente (también con las teclas ← →).

## Regla de las cuentas
La **ida** y la **llegada** son montos aparte y **nunca se suman**. Todos los gastos (los del viaje, el diésel y los demás) se descuentan **solo de la llegada**: llegada final = llegada neto − diésel − otros gastos.
