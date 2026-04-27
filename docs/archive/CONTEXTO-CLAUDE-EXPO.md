# Handoff Claude - Expo Go / Mobile Debug

Fecha: 2026-04-21
Repositorio: opalbar-app
Objetivo de este archivo: permitir que otro agente retome exactamente el estado de troubleshooting sin perder tiempo.

## 1) Resumen ejecutivo

Se trabajaron dos frentes en paralelo:
1. Acceso remoto de Expo Go (fallas de 503, "downloading", QR inválidos por host efímero).
2. Crash de render en perfil de usuario (error de propiedad relTime).

Estado actual:
- El crash de render fue corregido en código.
- Expo está levantado con túnel activo y validación HTTP correcta (manifest 200 y launchAsset 200) al momento de este handoff.
- El acceso remoto sigue siendo sensible a rotación de host de localhost.run (esperable). Se dejó flujo operativo para rotar y revalidar rápido.

## 2) Causa raíz encontrada (Expo Go)

No era backend.
- API local y pública respondieron 200 en health.

La causa real era desalineación de host/puerto entre:
- túnel activo,
- EXPO_PACKAGER_PROXY_URL,
- puerto real de Metro,
- launchAsset que Expo publica en el manifest.

Cuando esos 4 no coinciden, Expo Go recibe HTML/503 (error detail con h1) o se queda en descarga.

## 3) Problemas concretos observados

1. expo start --tunnel falló repetidamente por timeout de ngrok.
2. Nx no fue confiable para este caso porque cuando el puerto estaba ocupado pedía interacción y cortaba el flujo.
3. localhost.run cambia dominio con frecuencia.
4. En intentos previos, manifest devolvía launchAsset con :8093 inaccesible desde afuera.
5. También se detectó caso de host mismatch:
- túnel nuevo en host A,
- Metro anunciado en host B,
- resultado: 503/HTML.

## 4) Solución operativa que sí funcionó

Patrón estable usado:
1. Levantar túnel localhost.run a un puerto fijo del Metro.
2. Arrancar Expo en LAN con clear cache y EXPO_PACKAGER_PROXY_URL apuntando al mismo host del túnel.
3. Validar por HTTP:
- GET https://<host>/?platform=ios -> 200
- extraer launchAsset.url del manifest
- GET launchAsset.url -> 200
4. Generar QR solo después de validar launchAsset 200.

## 5) Estado vivo al cierre de esta sesión

Túnel activo:
- Host: https://e3a10951b7f510.lhr.life
- Túnel: localhost.run -> localhost:8095

Metro activo:
- Puerto local: 8095
- Proxy URL: https://e3a10951b7f510.lhr.life
- Expo reportado: exp://e3a10951b7f510.lhr.life

Validación hecha:
- manifest=200
- launchAsset=https://e3a10951b7f510.lhr.life/apps/mobile/index.bundle?... 
- launchAssetStatus=200

QR generado:
- apps/mobile/qr-expo-go-live-fixed.png
- target codificado: exp://e3a10951b7f510.lhr.life

## 6) Fix de código aplicado (render crash)

Error reportado por usuario:
- Render Error: Property 'relTime' doesn't exist
- Stack apuntaba a filteredWallPosts.map en users/[id].tsx

Cambio aplicado:
- Archivo: apps/mobile/app/(app)/users/[id].tsx
- Se renombró helper local:
- relTime -> formatRelativeTime
- Se actualizaron ambos usos en el render de posts.

Líneas verificadas:
- helper: linea 19
- uso 1: linea 348
- uso 2: linea 441

Validación:
- Sin errores estáticos en ese archivo después del patch.

## 7) Archivos tocados en esta etapa

1. apps/mobile/app/(app)/users/[id].tsx
2. apps/mobile/qr-expo-go-live-fixed.png (regenerado varias veces)

## 8) Comandos clave usados (referencia rápida)

Túnel localhost.run:
- ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:8095 nokey@localhost.run

Expo con proxy host fijo:
- Set-Location apps/mobile
- $env:EXPO_PACKAGER_PROXY_URL='https://e3a10951b7f510.lhr.life'
- npx expo start --lan --clear --port 8095

Validación manifest + launchAsset:
- Invoke-WebRequest a https://<host>/?platform=ios con Accept expo+json
- Parse de launchAsset.url
- Invoke-WebRequest a launchAsset.url y revisar StatusCode

Generación QR:
- API qrserver con target exp://<host>
- Output: apps/mobile/qr-expo-go-live-fixed.png

## 9) Playbook si vuelve a fallar (paso a paso para Claude)

1. Verificar si Metro sigue corriendo y qué host está anunciando.
2. Verificar si el túnel sigue activo o rotó host.
3. Si hay mismatch host/puerto:
- reiniciar Metro con EXPO_PACKAGER_PROXY_URL igual al host del túnel activo,
- mantener puerto fijo (8095 o el que quede realmente libre),
- alinear túnel al mismo puerto.
4. Revalidar manifest y launchAsset (ambos 200).
5. Re-generar QR y entregar solo el más nuevo.

Regla importante:
- No confiar en QR viejo. Cada rotación de host invalida el QR anterior.

## 10) Riesgos pendientes

1. localhost.run es efímero; el dominio puede morir mientras el usuario prueba.
2. Expo package versions muestran advertencias de compatibilidad (no bloqueante inmediato, pero recomendable normalizar).
3. El flujo depende de interacción mínima cuando un puerto está ocupado; ideal blindarlo con scripts que no pidan confirmación.

## 11) Recomendaciones de endurecimiento (siguiente iteración)

1. Script único de bootstrap que:
- detecte puerto libre,
- levante túnel,
- arranque Expo con proxy correcto,
- valide manifest y bundle,
- regenere QR automáticamente.

2. Persistir log de host actual en archivo temporal para evitar confusión de dominios.

3. Opcional: migrar a un proveedor de túnel más estable para sesiones largas.

---

Documento generado para traspaso entre agentes. Si hay contradicción entre este archivo y la terminal en vivo, priorizar siempre estado en vivo de terminal y verificaciones HTTP.
