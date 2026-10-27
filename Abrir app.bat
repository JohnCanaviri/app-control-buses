@echo off
title Control de Buses
cd /d "%~dp0"
echo Iniciando Control de Buses... (no cierres esta ventana mientras uses la app)
if not exist node_modules call npm install
call npm run dev -- --open
