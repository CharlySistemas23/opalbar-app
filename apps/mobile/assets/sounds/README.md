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

## Toggle global

Los usuarios pueden apagar sonidos y haptics desde Ajustes — controlado por
`soundsEnabled` y `hapticsEnabled` en `useAppStore`.

## Formato

Formato recomendado: **WAV o MP3, mono, < 500 KB**. Los archivos actuales
pesan ~2 MB en total, aceptable para el bundle.
