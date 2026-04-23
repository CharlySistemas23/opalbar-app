# Sound effects

Descarga archivos `.mp3` cortos (< 200ms para efectos, ~1s para notificaciones)
y colócalos aquí con estos nombres exactos:

| Archivo | Cuándo suena | Sugerencia |
|---|---|---|
| `pop.mp3` | Like / heart toggle | "pop" corto, burbuja |
| `bubble.mp3` | Enviar comentario o mensaje | "bloop" tipo iMessage |
| `success.mp3` | Reserva / canje confirmado | campanilla corta ascendente |
| `coin.mp3` | Ganar puntos | moneda estilo mario |
| `error.mp3` | Error / validación fallida | beep descendente corto |
| `chime.mp3` | Logout / cerrar ventana | tink suave |
| `notification.mp3` | Toast / push entrante | ding corto |

## Cómo obtenerlos gratis

- https://freesound.org/ (CC0, buscar "ui beep short")
- https://pixabay.com/sound-effects/ (libre de uso)
- https://mixkit.co/free-sound-effects/ (UI sounds)
- iMessage-like pops: buscar "pop ui short"

Formato recomendado: **MP3 64–128 kbps, mono, < 100 KB cada uno** para que el
bundle no crezca.

## Activación

El archivo `src/hooks/useFeedback.ts` ya tiene el mapeo preparado. Solo
descomentar las líneas `require()` en `SOUND_ASSETS` cuando los archivos
existan. Mientras tanto, los haptics (vibración sutil) funcionan en todos los
eventos — es 80% del "feel" premium.
