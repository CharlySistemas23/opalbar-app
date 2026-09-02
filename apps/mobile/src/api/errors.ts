// ─────────────────────────────────────────────
//  API error message formatter
//
//  Backend messages are English; the app is Spanish-first. Common messages
//  are translated here so users never see "Invalid credentials" raw.
// ─────────────────────────────────────────────

function currentLang(): 'es' | 'en' {
  try {
    // Lazy require avoids an import cycle (store → client → errors).
    const { useAppStore } = require('@/stores/app.store');
    return useAppStore.getState().language === 'en' ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

const ES: Array<[RegExp, string]> = [
  [/^invalid credentials$/i, 'Correo o contraseña incorrectos.'],
  [/^user not found$/i, 'No encontramos una cuenta con esos datos.'],
  [/account with this email already exists/i, 'Ya existe una cuenta con este correo.'],
  [/account with this phone number already exists/i, 'Ya existe una cuenta con este teléfono.'],
  [/account has been suspended/i, 'Tu cuenta fue suspendida. Contacta a soporte.'],
  [/^invalid otp code$/i, 'Código incorrecto.'],
  [/otp has expired/i, 'El código expiró. Pide uno nuevo.'],
  [/otp not found or expired/i, 'El código expiró. Pide uno nuevo.'],
  [/too many failed attempts/i, 'Demasiados intentos. Espera un momento.'],
  [/too many requests/i, 'Demasiadas peticiones. Espera un momento.'],
  [/current password is incorrect/i, 'La contraseña actual es incorrecta.'],
  [/password must/i, 'La contraseña debe tener 8+ caracteres, mayúscula, número y símbolo.'],
  [/^unauthorized$/i, 'Tu sesión expiró. Vuelve a iniciar sesión.'],
  [/^forbidden( resource)?$/i, 'No tienes permiso para hacer esto.'],
  [/^not authorized$/i, 'No tienes permiso para hacer esto.'],
  [/^access denied$/i, 'No tienes permiso para hacer esto.'],
  [/^not your story$/i, 'Esta historia no es tuya.'],
  [/ticket closed/i, 'Este ticket ya está cerrado.'],
  [/account scheduled for deletion/i, 'Esta cuenta está programada para eliminarse. Contacta a soporte si quieres recuperarla.'],
  [/password is required to delete/i, 'Escribe tu contraseña para eliminar la cuenta.'],
  [/event is not open for reservations/i, 'Este evento ya no acepta reservaciones.'],
  [/event has already finished/i, 'Este evento ya terminó.'],
  [/event is at full capacity/i, 'El evento está lleno.'],
  [/cannot reserve a past date/i, 'No puedes reservar una fecha pasada.'],
  [/time slot has already passed/i, 'Ese horario ya pasó.'],
  [/time slot is outside opening hours/i, 'Ese horario está fuera del horario del bar.'],
  [/time slot is blocked/i, 'Ese horario no está disponible.'],
  [/reservations are currently disabled/i, 'Las reservaciones están deshabilitadas por ahora.'],
  [/no (seats|capacity) (left|available)/i, 'Ya no hay lugares en ese horario.'],
  [/offer is not active/i, 'Esta oferta ya no está activa.'],
  [/offer is not currently valid/i, 'Esta oferta no está vigente.'],
  [/offer has been fully redeemed/i, 'Esta oferta ya se agotó.'],
  [/offer is not valid today/i, 'Esta oferta no aplica hoy.'],
  [/offer is not valid at this time/i, 'Esta oferta no aplica a esta hora.'],
  [/already redeemed this offer/i, 'Ya canjeaste esta oferta el máximo de veces.'],
  [/insufficient points/i, 'No tienes puntos suficientes.'],
  [/being redeemed by another user/i, 'Inténtalo de nuevo en un segundo.'],
  [/reservation cannot be seated/i, 'Esta reservación no se puede registrar.'],
  [/redemption expired/i, 'Este canje ya expiró.'],
  [/private account/i, 'Cuenta privada. Síguela para ver esta lista.'],
  [/does not accept friend requests/i, 'Este usuario no acepta solicitudes de amistad.'],
  [/only friends of friends/i, 'Solo acepta solicitudes de amigos de sus amigos.'],
  [/can'?t follow yourself/i, 'No puedes seguirte a ti mismo.'],
  [/cannot (follow|message) this user/i, 'No puedes interactuar con este usuario.'],
  [/blocked/i, 'No puedes interactuar con este usuario.'],
  [/not found/i, 'No encontrado.'],
  [/should not exist/i, 'Datos inválidos. Actualiza la app.'],
  [/must be a valid/i, 'Datos inválidos.'],
];

function translate(msg: string): string {
  if (currentLang() === 'en') return msg;
  for (const [re, es] of ES) if (re.test(msg)) return es;
  return msg;
}

export function apiError(err: any, fallback?: string): string {
  const es = currentLang() === 'es';
  const fb = fallback ?? (es ? 'Algo salió mal. Intenta de nuevo.' : 'Something went wrong');
  if (!err) return fb;

  // Has server response
  if (err.response) {
    const status = err.response.status;
    const data = err.response.data;

    // NestJS sends { message: string | string[], error, statusCode }
    let msg = data?.message;
    if (Array.isArray(msg)) msg = msg.map((m: any) => translate(String(m))).join('\n');
    else if (typeof msg === 'string' && msg) msg = translate(msg);
    if (typeof msg === 'string' && msg) return msg;
    if (data?.error && typeof data.error === 'string') return `${translate(data.error)} (${status})`;

    if (status === 401) return es ? 'Tu sesión expiró. Vuelve a iniciar sesión.' : 'Session expired. Sign in again.';
    if (status === 403) return es ? 'No tienes permiso.' : 'Not allowed.';
    if (status === 404) return es ? 'No encontrado.' : 'Not found.';
    if (status === 413) return es ? 'Archivo demasiado grande.' : 'File too large.';
    if (status === 429) return es ? 'Demasiadas peticiones. Espera un momento.' : 'Too many requests. Wait a moment.';
    if (status === 503) return es ? 'Servicio no disponible. Intenta más tarde.' : 'Service unavailable.';
    if (status >= 500) return es ? `Error del servidor (${status}).` : `Server error (${status}).`;
    return `Error ${status}`;
  }

  // No response → network / config
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return es ? 'Tiempo agotado. Revisa tu conexión.' : 'Timed out. Check your connection.';
  }
  if (err.message && /Network Error|Network request failed/i.test(err.message)) {
    return es ? 'Sin conexión. Revisa tu internet.' : 'No connection. Check your internet.';
  }
  if (err.message && err.message !== 'Error') return translate(err.message);

  return fb;
}
