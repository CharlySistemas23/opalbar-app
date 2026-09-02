# Sound effects

Archivos cargados y cableados en [src/hooks/useFeedback.ts](../../src/hooks/useFeedback.ts).

| Archivo | Evento semántico | Se dispara en |
| --- | --- | --- |
| `POP.wav` | `pop` | Like / heart toggle (`fb.like()`) |
| `BUBBLE.wav` | `bubble` | Enviar mensaje o comentario (`fb.send()`) |
| `SUCESS.wav` | `success` | Reserva / canje confirmado (`fb.success()`) |
| `COINT.wav` | `coin` | Ganar puntos de loyalty (`fb.coin()`) |
| `CANCEL.wav` | `error` | Validación fallida / error API (`fb.error()`) |
| `CHIME.wav` | `chime` | Logout (`fb.logout()`) |
| `NOTIFICATION.wav` | `notification` | Toast / push entrante (`fb.notification()`) |
| `TICK.wav` | `tick` | Navegación: tab, Card, ListItem, segmented, toast info (`fb.nav()`) |
| `TOGGLE.wav` | `toggle` | Switch on/off (`fb.toggle()`) |
| `WHOOSH.wav` | `whoosh` | Apertura de Sheet / Modal / ReactionPicker (`fb.open()`) |
| `SWOOSH.wav` | `swoosh` | Pull-to-refresh (`fb.refresh()`) |

`TICK/TOGGLE/WHOOSH/SWOOSH` son sintetizados (ffmpeg), mono, < 35 KB. Volumen
por sonido en `SOUND_VOLUME` (useFeedback.ts) — micro-sonidos bajos, confirmaciones
plenas.

## Atmósfera (loops de ambiente) — RETIRADA

Se probó una cama de audio de fondo en loop por ruta, pero se eliminó: el loop
continuo + los fades mantenían CPU/audio despiertos y drenaban batería. Solo
quedan los SFX one-shot de arriba (baratos, sin coste en reposo).

## Toggle global

Los usuarios pueden apagar sonidos y haptics desde Ajustes — controlado por
`soundsEnabled` y `hapticsEnabled` en `useAppStore`.

## Formato

Formato recomendado: **WAV o MP3, mono, < 500 KB**. Los archivos actuales
pesan ~2 MB en total, aceptable para el bundle.
