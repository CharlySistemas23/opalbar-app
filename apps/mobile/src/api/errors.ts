// ─────────────────────────────────────────────
//  API error message formatter
// ─────────────────────────────────────────────

export function apiError(err: any, fallback = 'Something went wrong'): string {
  if (!err) return fallback;

  // Has server response
  if (err.response) {
    const status = err.response.status;
    const data = err.response.data;

    // NestJS sends { message: string | string[], error, statusCode }
    let msg = data?.message;
    if (Array.isArray(msg)) msg = msg.join(', ');
    if (typeof msg === 'string' && msg) return msg;
    if (data?.error && typeof data.error === 'string') return `${data.error} (${status})`;

    if (status === 401) return 'No pudimos conectar. Intenta de nuevo.';
    if (status === 403) return 'No tienes permiso.';
    if (status === 404) return 'No encontrado.';
    if (status === 413) return 'Archivo demasiado grande.';
    if (status === 429) return 'Demasiadas peticiones. Espera un momento.';
    if (status >= 500) return `Error del servidor (${status}).`;
    return `Error ${status}`;
  }

  // No response → network / config
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return 'Tiempo agotado. Revisa tu conexión.';
  }
  if (err.message && /Network Error|Network request failed/i.test(err.message)) {
    return 'Error de red. Revisa que estés conectado.';
  }
  if (err.message && err.message !== 'Error') return err.message;

  return fallback;
}
