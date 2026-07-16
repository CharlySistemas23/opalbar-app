// ─────────────────────────────────────────────
//  HTML de privacidad y términos. Mantenido en código para que se
//  versione con el repo y no requiera infra extra (CDN, MDX, etc.).
//  Cada cambio sustantivo debería bumpear la versión + fecha de
//  actualización al final del documento.
// ─────────────────────────────────────────────

const SHARED_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #F5F3EE;
    color: #1A1A1E;
    line-height: 1.65;
  }
  .container {
    max-width: 720px;
    margin: 0 auto;
    padding: 56px 24px 96px;
  }
  .brand {
    text-align: center;
    margin-bottom: 36px;
  }
  .wordmark {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    letter-spacing: 6px;
    text-transform: uppercase;
  }
  .rule {
    width: 32px;
    height: 1px;
    background: #1A1A1E;
    margin: 12px auto 0;
  }
  h1 {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 32px;
    font-weight: 400;
    margin: 0 0 8px;
    letter-spacing: -0.4px;
  }
  .subtitle { color: #8A8A92; font-size: 13px; margin: 0 0 32px; }
  h2 {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px;
    font-weight: 400;
    margin: 36px 0 12px;
    letter-spacing: -0.2px;
  }
  h3 {
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #3A3A42;
    margin: 24px 0 8px;
  }
  p { margin: 0 0 16px; font-size: 15px; color: #2A2A30; }
  ul { padding-left: 22px; margin: 0 0 16px; }
  li { margin-bottom: 6px; font-size: 15px; }
  strong { color: #1A1A1E; }
  a { color: #C97D1F; text-decoration: underline; }
  .meta {
    margin-top: 56px;
    padding-top: 24px;
    border-top: 1px solid #E5E3DD;
    color: #8A8A92;
    font-size: 12px;
  }
  .meta strong { color: #3A3A42; }
`;

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · OPAL BAR</title>
<style>${SHARED_CSS}</style>
</head>
<body>
  <div class="container">
    <div class="brand">
      <div class="wordmark">OPAL BAR</div>
      <div class="rule"></div>
    </div>
    ${body}
    <div class="meta">
      <p>
        <strong>OPAL BAR PV</strong> · Puerto Vallarta, Jalisco, México<br />
        Contacto: <a href="mailto:carlosalonsog966@gmail.com">carlosalonsog966@gmail.com</a>
      </p>
      <p>Última actualización: 29 de abril de 2026 · Versión 1.0</p>
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────
//  PRIVACY POLICY
// ─────────────────────────────────────────────
export const PRIVACY_POLICY_HTML = shell(
  'Política de privacidad',
  `
  <h1>Política de privacidad</h1>
  <p class="subtitle">Cómo recolectamos, usamos y protegemos tu información en OPAL BAR.</p>

  <p>OPAL BAR ("nosotros", "la app") respeta tu privacidad. Esta política explica qué datos personales recolectamos cuando usás nuestra app móvil y qué hacemos con ellos. Al usar la app aceptás esta política.</p>

  <h2>1. Datos que recolectamos</h2>

  <h3>a. Datos que vos nos das</h3>
  <ul>
    <li><strong>Datos de cuenta:</strong> nombre, apellido, email, número de teléfono opcional, fecha de nacimiento opcional, ciudad, idioma preferido.</li>
    <li><strong>Foto de perfil y portada:</strong> opcionales, las cargás vos.</li>
    <li><strong>Contenido de comunidad:</strong> publicaciones, comentarios, reacciones, historias e imágenes que decidas compartir.</li>
    <li><strong>Mensajes privados:</strong> conversaciones DM con otros usuarios.</li>
    <li><strong>Reservaciones:</strong> fecha, hora, cantidad de personas, notas opcionales.</li>
    <li><strong>Reseñas:</strong> calificación, título, comentario sobre venues.</li>
    <li><strong>Tickets de soporte:</strong> cualquier mensaje que envíes al equipo.</li>
  </ul>

  <h3>b. Datos que recolectamos automáticamente</h3>
  <ul>
    <li><strong>Identificadores de dispositivo:</strong> device token de push, sistema operativo, modelo aproximado, idioma del sistema.</li>
    <li><strong>Datos de sesión:</strong> dirección IP, user agent, fechas de login, sesiones activas.</li>
    <li><strong>Eventos de uso:</strong> qué pantallas visitás, qué eventos asistís, qué ofertas canjeás (para personalizar contenido).</li>
    <li><strong>Datos de moderación:</strong> reportes que hacés o que otros usuarios hacen sobre vos.</li>
  </ul>

  <h3>c. Datos que NO recolectamos</h3>
  <ul>
    <li>Ubicación GPS continua del dispositivo (solo la ciudad que vos declarás).</li>
    <li>Lista de contactos de tu teléfono.</li>
    <li>Datos de salud, biometría facial o huella, ni datos financieros (no procesamos pagos directamente).</li>
  </ul>

  <h2>2. Cómo usamos tus datos</h2>
  <ul>
    <li><strong>Para operar la app:</strong> autenticarte, mostrarte el feed, gestionar reservaciones, mandar mensajes.</li>
    <li><strong>Para personalizar tu experiencia:</strong> recomendar eventos, ofertas y contenido afín.</li>
    <li><strong>Para comunicarnos con vos:</strong> notificaciones push de eventos, mensajes nuevos, broadcasts del bar.</li>
    <li><strong>Para moderación y seguridad:</strong> revisar reportes, prevenir spam y abusos, suspender cuentas que violan los términos.</li>
    <li><strong>Para cumplir obligaciones legales:</strong> responder solicitudes de autoridades cuando aplique.</li>
    <li><strong>Para mejorar el producto:</strong> análisis agregado y anónimo de uso.</li>
  </ul>

  <h2>3. Con quién compartimos tus datos</h2>
  <p>No vendemos tus datos. Compartimos solo cuando es necesario:</p>
  <ul>
    <li><strong>Otros usuarios de la app:</strong> tu nombre, foto y publicaciones públicas. No exponemos tu email ni teléfono.</li>
    <li><strong>Proveedores de infraestructura:</strong> Railway (base de datos y servidor), Cloudinary (almacenamiento de imágenes), Twilio (verificación SMS opcional), Resend (correo transaccional), Expo y los servicios de notificación push de Google (FCM) y Apple (APNs). Cada proveedor procesa datos solo para prestar su servicio.</li>
    <li><strong>Autoridades:</strong> solo si hay una orden judicial válida o requerimiento legal.</li>
  </ul>
  <p><strong>No usamos tus datos para publicidad de terceros ni para rastreo (tracking) entre apps o sitios web.</strong> No compartimos tus datos con brokers de datos ni redes publicitarias. Los datos se usan únicamente para operar la app (autenticación, reservas, comunidad, notificaciones), para análisis interno del producto y para comunicaciones propias del servicio.</p>

  <h2>4. Tus derechos (GDPR-compatible)</h2>
  <p>Tenés derecho a:</p>
  <ul>
    <li><strong>Acceder a tus datos:</strong> pedir una copia de toda la información que tenemos sobre vos.</li>
    <li><strong>Corregir errores:</strong> editar tu perfil en cualquier momento desde la app.</li>
    <li><strong>Eliminar tu cuenta:</strong> solicitar el borrado de tu cuenta y todos sus datos asociados desde Configuración → GDPR. La eliminación efectiva se aplica tras un período de gracia de 7 días.</li>
    <li><strong>Exportar tus datos:</strong> solicitar un archivo descargable con todos tus datos (JSON estructurado).</li>
    <li><strong>Retirar consentimiento de marketing:</strong> desuscribirte de emails y push promocionales en Configuración → Notificaciones.</li>
  </ul>
  <p>Para ejercer cualquiera de estos derechos contactá a <a href="mailto:carlosalonsog966@gmail.com">carlosalonsog966@gmail.com</a>.</p>

  <h2>5. Retención de datos</h2>
  <ul>
    <li><strong>Cuenta activa:</strong> mientras uses la app.</li>
    <li><strong>Cuenta eliminada:</strong> los datos se borran o anonimizan tras los 7 días de gracia. Información de cumplimiento legal (logs de auditoría, transacciones) puede retenerse hasta 730 días.</li>
    <li><strong>Mensajes y publicaciones:</strong> se mantienen mientras la cuenta esté activa. Si eliminás tu cuenta, se anonimizan.</li>
  </ul>

  <h2>6. Seguridad</h2>
  <p>Aplicamos medidas razonables para proteger tus datos: contraseñas hasheadas con bcrypt, conexiones HTTPS, autenticación con JWT con rotación de tokens, 2FA obligatorio para administradores, infraestructura administrada por Railway. Ningún sistema es 100% seguro; te recomendamos usar contraseñas fuertes y no compartirlas.</p>

  <h2>7. Edad mínima</h2>
  <p>OPAL BAR es una app de nightlife dirigida a personas <strong>mayores de 18 años</strong>. No recolectamos datos a sabiendas de menores de edad. Si descubrimos una cuenta de un menor, la eliminamos.</p>

  <h2>8. Cambios a esta política</h2>
  <p>Podemos actualizar esta política. Las cambios sustantivos se comunican por notificación push o email. Seguir usando la app después de un cambio implica aceptación de la nueva versión.</p>

  <h2>9. Contacto</h2>
  <p>Si tenés alguna pregunta sobre esta política o sobre el manejo de tus datos:</p>
  <ul>
    <li>Email: <a href="mailto:carlosalonsog966@gmail.com">carlosalonsog966@gmail.com</a></li>
  </ul>
  `,
);

// ─────────────────────────────────────────────
//  ACCOUNT DELETION (Play Store requirement)
//  Google exige una URL pública dedicada con instrucciones claras
//  de como pedir el borrado de cuenta. Tiene que decir explicitamente:
//   - Nombre de la app/desarrollador
//   - Pasos para solicitar el borrado
//   - Qué datos se borran y cuáles se conservan + plazos
// ─────────────────────────────────────────────
export const ACCOUNT_DELETION_HTML = shell(
  'Eliminación de cuenta',
  `
  <h1>Eliminar mi cuenta de OPAL BAR</h1>
  <p class="subtitle">Cómo solicitar la eliminación de tu cuenta y de los datos asociados.</p>

  <p>En <strong>OPAL BAR</strong> (desarrollada por OPAL BAR PV, Puerto Vallarta) podés solicitar la eliminación de tu cuenta y de los datos personales asociados en cualquier momento. A continuación te explicamos cómo hacerlo y qué pasa con tus datos.</p>

  <h2>Opción 1 — Desde la app (recomendado)</h2>
  <ol>
    <li>Abrí la app OPAL BAR e iniciá sesión.</li>
    <li>Andá a <strong>Perfil</strong> (icono inferior derecho).</li>
    <li>Tocá el icono de <strong>Configuración</strong> (engranaje arriba a la derecha).</li>
    <li>Bajá hasta la sección <strong>Privacidad y datos</strong>.</li>
    <li>Tocá <strong>"Eliminar mi cuenta"</strong>.</li>
    <li>Confirmá tu contraseña y la solicitud.</li>
  </ol>
  <p>La solicitud queda registrada inmediatamente y entra en período de gracia de 7 días (durante ese tiempo podés cancelarla volviendo a iniciar sesión).</p>

  <h2>Opción 2 — Por email</h2>
  <p>Si no podés acceder a la app, escribí a <a href="mailto:carlosalonsog966@gmail.com">carlosalonsog966@gmail.com</a> desde el email registrado en tu cuenta con el asunto <strong>"Eliminar mi cuenta"</strong>. Te respondemos en un plazo máximo de 30 días confirmando la eliminación.</p>

  <h2>Qué datos se eliminan</h2>
  <p>Al confirmarse el borrado de tu cuenta, eliminamos o anonimizamos:</p>
  <ul>
    <li>Tu perfil (nombre, foto, email, teléfono, fecha de nacimiento, ciudad, idioma).</li>
    <li>Tus publicaciones, comentarios, reacciones e historias en la comunidad.</li>
    <li>Tus mensajes privados (DMs) son anonimizados — el contenido se elimina pero la conversación queda como "Usuario eliminado".</li>
    <li>Tus reseñas de venues.</li>
    <li>Tus reservaciones futuras (las pasadas se anonimizan para registros operativos del bar).</li>
    <li>Tus tickets de soporte abiertos.</li>
    <li>Sesiones activas, push tokens, intereses, consentimientos.</li>
    <li>Foto de perfil y portada (almacenadas en Cloudinary).</li>
  </ul>

  <h2>Qué datos se conservan y por cuánto tiempo</h2>
  <p>Por requisitos legales y de cumplimiento, retenemos cierta información de forma anonimizada:</p>
  <ul>
    <li><strong>Logs de auditoría de acciones de moderación</strong> en los que tu cuenta haya estado involucrada (reportes, sanciones): hasta <strong>730 días</strong> (configurable vía <code>DATA_RETENTION_DAYS</code>).</li>
    <li><strong>Registros de transacciones agregadas</strong> (cantidad de reservaciones por noche, eventos, etc.): de forma anónima e indefinida (sin tu nombre ni contacto).</li>
    <li><strong>Logs técnicos</strong> (errores, accesos a la API): hasta 90 días con tu ID anonimizado.</li>
    <li><strong>Registros de cumplimiento legal</strong> (solicitudes de autoridades, si hubo): según lo exija la autoridad correspondiente.</li>
  </ul>
  <p>Después de los plazos indicados, esos registros también se eliminan de forma definitiva.</p>

  <h2>Período de gracia y cancelación</h2>
  <p>Una vez solicitada la eliminación, tu cuenta queda en estado <strong>"pendiente de eliminación"</strong> durante 7 días. En ese plazo podés cancelar la solicitud volviendo a iniciar sesión y aceptando un mensaje de confirmación. Después de 7 días la eliminación es <strong>irreversible</strong>.</p>

  <h2>Datos de menores</h2>
  <p>OPAL BAR es una app dirigida a personas mayores de 18 años. Si descubrimos que existe una cuenta de un menor, la eliminamos inmediatamente sin necesidad de solicitud previa.</p>

  <h2>Contacto</h2>
  <p>Para cualquier pregunta sobre el proceso de eliminación o sobre tus datos:</p>
  <ul>
    <li>Email: <a href="mailto:carlosalonsog966@gmail.com">carlosalonsog966@gmail.com</a></li>
    <li>Política de privacidad completa: <a href="/api/v1/legal/privacy">/api/v1/legal/privacy</a></li>
  </ul>
  `,
);

// ─────────────────────────────────────────────
//  TERMS OF SERVICE
// ─────────────────────────────────────────────
export const TERMS_OF_SERVICE_HTML = shell(
  'Términos de servicio',
  `
  <h1>Términos de servicio</h1>
  <p class="subtitle">Reglas para usar OPAL BAR. Al usar la app aceptás estos términos.</p>

  <h2>1. Aceptación</h2>
  <p>Al crear una cuenta o usar la app OPAL BAR aceptás estos términos. Si no estás de acuerdo, no uses la app.</p>

  <h2>2. Edad mínima</h2>
  <p>Tenés que tener <strong>al menos 18 años</strong> para usar OPAL BAR. La app contiene contenido relacionado con vida nocturna, alcohol y eventos para adultos.</p>

  <h2>3. Tu cuenta</h2>
  <ul>
    <li>Sos responsable de mantener la confidencialidad de tu contraseña.</li>
    <li>No podés compartir tu cuenta con otras personas.</li>
    <li>Tenés que dar información verdadera al registrarte (nombre, edad, contacto).</li>
    <li>Podemos suspender o eliminar tu cuenta si violás estos términos o las normas de la comunidad.</li>
  </ul>

  <h2>4. Normas de la comunidad</h2>
  <p><strong>OPALBAR aplica una política de TOLERANCIA CERO frente al contenido objetable y los usuarios abusivos.</strong> El contenido objetable y el comportamiento abusivo no están permitidos. El contenido reportado se revisa y se retira, y las cuentas infractoras se suspenden o eliminan, dentro de las 24 horas siguientes. Al usar la app aceptas estas normas.</p>
  <p>Está <strong>prohibido</strong>:</p>
  <ul>
    <li>Publicar contenido ilegal, ofensivo, discriminatorio o violento.</li>
    <li>Acoso, bullying o amenazas hacia otros usuarios.</li>
    <li>Suplantar la identidad de otra persona o del bar.</li>
    <li>Spam, publicidad no autorizada, esquemas piramidales.</li>
    <li>Subir contenido sexual explícito, desnudos, o material protegido por derechos de autor sin permiso.</li>
    <li>Intentar hackear, scrapear masivamente o atacar la infraestructura de la app.</li>
    <li>Usar la app para vender drogas, armas u otros bienes ilegales.</li>
  </ul>
  <p>El equipo de moderación se reserva el derecho de retirar contenido y suspender cuentas sin aviso previo cuando se viola alguna de estas reglas.</p>

  <h2>5. Reservaciones</h2>
  <ul>
    <li>Las reservaciones están sujetas a disponibilidad.</li>
    <li>Cancelar con menos de 4 horas de anticipación o no presentarse (no-show) puede afectar la prioridad en futuras reservas.</li>
    <li>El bar se reserva el derecho de admisión según código de vestimenta y políticas internas.</li>
  </ul>

  <h2>6. Reseñas y comentarios</h2>
  <p>Las reseñas que publicás deben ser honestas y basadas en tu experiencia real. Las reseñas falsas, ofensivas o difamatorias serán eliminadas. El equipo de moderación puede aprobar, rechazar o eliminar reseñas a su criterio.</p>

  <h2>7. Mensajes privados</h2>
  <p>Los mensajes privados (DMs) entre usuarios pueden ser supervisados por el equipo de moderación si hay un reporte o sospecha de actividad ilegal/abusiva. Esta supervisión cumple con la legislación aplicable.</p>

  <h2>8. Contenido que subís</h2>
  <p>Mantenés la propiedad de tu contenido (fotos, publicaciones). Al publicar nos das una licencia no exclusiva para mostrarlo dentro de la app y en materiales promocionales del bar (si así se acuerda explícitamente).</p>

  <h2>9. Limitación de responsabilidad</h2>
  <p>OPAL BAR se ofrece "tal como está". No garantizamos disponibilidad continua ni libre de errores. No nos hacemos responsables por daños indirectos, lucro cesante o pérdida de datos. La responsabilidad máxima en caso de cualquier reclamo se limita al monto efectivamente pagado por el usuario en los últimos 12 meses (típicamente cero, ya que la app es gratuita).</p>

  <h2>10. Contenido de terceros</h2>
  <p>La app puede contener enlaces o integrar servicios de terceros (Cloudinary, Twilio, Google, Apple). Cada uno tiene sus propios términos y políticas que también deberías revisar.</p>

  <h2>11. Suspensión y eliminación de cuenta</h2>
  <p>Podemos suspender o eliminar tu cuenta si:</p>
  <ul>
    <li>Violás estos términos o las normas de la comunidad.</li>
    <li>Tu cuenta está inactiva por más de 24 meses.</li>
    <li>Detectamos actividad fraudulenta o uso indebido.</li>
  </ul>
  <p>Vos también podés eliminar tu cuenta en cualquier momento desde la app (Configuración → GDPR → Eliminar mi cuenta).</p>

  <h2>12. Cambios a estos términos</h2>
  <p>Podemos actualizar estos términos en cualquier momento. Te avisaremos por notificación push o email ante cambios sustantivos. Seguir usando la app implica aceptación de la nueva versión.</p>

  <h2>13. Ley aplicable</h2>
  <p>Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia se resolverá en los tribunales de Puerto Vallarta, Jalisco.</p>

  <h2>14. Contacto</h2>
  <p>Cualquier consulta o reclamo: <a href="mailto:carlosalonsog966@gmail.com">carlosalonsog966@gmail.com</a></p>
  `,
);

// ─────────────────────────────────────────────
//  Estándares de Seguridad Infantil (CSAE) — requerido por Google Play
//  para apps de categoría Social/Citas. Debe estar publicado en una URL
//  pública, no editable, no ser PDF.
//  Cubre:
//   - Postura cero tolerancia contra CSAM
//   - Mecanismo de denuncia interno
//   - Cooperación con autoridades
//   - Punto de contacto designado
// ─────────────────────────────────────────────
export const CHILD_SAFETY_HTML = shell(
  'Estándares de Seguridad Infantil',
  `
  <h1>Estándares de Seguridad Infantil</h1>
  <p class="subtitle">Política contra la explotación y abuso sexual infantil (CSAE/CSAM) — OPAL BAR</p>

  <h2>1. Compromiso de tolerancia cero</h2>
  <p>OPAL BAR mantiene una postura de <strong>tolerancia cero</strong> hacia cualquier forma de explotación o abuso sexual infantil (CSAE) y contra cualquier material de abuso sexual infantil (CSAM). Está estrictamente prohibido publicar, compartir, almacenar, solicitar o transmitir contenido de esta naturaleza en cualquier parte de la aplicación, incluyendo publicaciones, comentarios, mensajes directos, historias, transmisiones, perfiles y avatares.</p>

  <h2>2. Edad mínima de uso</h2>
  <p>OPAL BAR es una aplicación destinada exclusivamente a personas <strong>mayores de 18 años</strong>, dado que el servicio promociona y gestiona reservas en establecimientos de venta de bebidas alcohólicas. Los menores de edad no están autorizados a registrarse ni utilizar la app. Las cuentas que se determinen como pertenecientes a menores serán deshabilitadas y eliminadas.</p>

  <h2>3. Medidas de prevención</h2>
  <ul>
    <li><strong>Verificación de edad</strong> en el registro mediante declaración explícita de mayoría de edad y aceptación de términos.</li>
    <li><strong>Moderación humana y automatizada</strong> de contenido público (publicaciones, comentarios, historias, fotos de perfil) para detectar y eliminar contenido potencialmente ilícito.</li>
    <li><strong>Restricciones técnicas</strong> sobre los mensajes directos: los mensajes entre usuarios que no son contactos requieren aceptación previa (sistema de "solicitudes de mensaje").</li>
    <li><strong>Filtros de palabras prohibidas</strong> en envíos públicos y nombres de usuario.</li>
    <li><strong>Bloqueo y eliminación inmediata</strong> de cuentas que violen esta política, sin posibilidad de re-registro con la misma identidad.</li>
  </ul>

  <h2>4. Mecanismo de denuncia interno</h2>
  <p>OPAL BAR pone a disposición de todos los usuarios un sistema visible y accesible para denunciar cualquier sospecha de CSAE, CSAM o conducta inapropiada hacia menores:</p>
  <ul>
    <li>Botón <strong>"Denunciar"</strong> en cada publicación, comentario, historia, mensaje y perfil de usuario dentro de la aplicación.</li>
    <li>Categoría específica <strong>"Seguridad infantil / CSAM"</strong> en el formulario de denuncia, priorizada sobre otras categorías.</li>
    <li>Canal directo de denuncia por correo electrónico: <a href="mailto:carlosalonsog966@gmail.com">carlosalonsog966@gmail.com</a></li>
  </ul>
  <p>Las denuncias relacionadas con seguridad infantil son tratadas con <strong>máxima prioridad</strong> y revisadas en un plazo objetivo de <strong>24 horas</strong> desde su recepción.</p>

  <h2>5. Acción frente a una denuncia</h2>
  <p>Al recibir una denuncia o detectar contenido sospechoso, OPAL BAR procede de la siguiente manera:</p>
  <ul>
    <li>Suspensión inmediata de la cuenta del presunto infractor mientras dura la revisión.</li>
    <li>Preservación de la evidencia (publicaciones, mensajes, metadatos, dirección IP, fechas) conforme a las obligaciones legales de retención.</li>
    <li>Eliminación del contenido infractor de todos los canales públicos y privados de la aplicación.</li>
    <li>Reporte a las <strong>autoridades pertinentes</strong> cuando exista sospecha razonable de comisión de un delito (ver sección 6).</li>
    <li>Cierre definitivo de la cuenta una vez confirmada la infracción.</li>
  </ul>

  <h2>6. Cooperación con autoridades</h2>
  <p>OPAL BAR cumple con todas las leyes de seguridad infantil aplicables y coopera con las autoridades competentes:</p>
  <ul>
    <li>En <strong>México</strong>: Fiscalía General de la República (FGR), Policía Cibernética de la Guardia Nacional, Sistema Nacional de Protección Integral de Niñas, Niños y Adolescentes (SIPINNA).</li>
    <li>En <strong>Estados Unidos</strong>: National Center for Missing &amp; Exploited Children (NCMEC) a través del CyberTipline cuando corresponda por la jurisdicción del contenido o del usuario.</li>
    <li>En cualquier otra jurisdicción donde se identifique al usuario, se cooperará con las autoridades nacionales y regionales correspondientes.</li>
  </ul>
  <p>OPAL BAR responde a las órdenes legales válidas (oficios, citatorios, órdenes judiciales) y entrega la información preservada conforme al marco legal aplicable.</p>

  <h2>7. Punto de contacto designado para CSAE/CSAM</h2>
  <p>El punto de contacto designado de OPAL BAR para asuntos relativos a la prevención de CSAM y al cumplimiento de esta política es:</p>
  <ul>
    <li><strong>Nombre:</strong> Carlos Alonso (representante legal de OPAL BAR)</li>
    <li><strong>Correo electrónico:</strong> <a href="mailto:carlosalonsog966@gmail.com">carlosalonsog966@gmail.com</a></li>
    <li><strong>Tiempo de respuesta objetivo:</strong> 24 horas para asuntos de seguridad infantil; 72 horas para otras consultas.</li>
  </ul>
  <p>Este punto de contacto está disponible para hablar con autoridades, plataformas y socios sobre las prácticas de prevención contra CSAM y el cumplimiento de la app.</p>

  <h2>8. Capacitación interna</h2>
  <p>El equipo de moderación y soporte de OPAL BAR recibe lineamientos escritos sobre la identificación, manejo y reporte de potenciales incidentes de CSAE/CSAM. La capacitación se actualiza anualmente o cuando cambian las regulaciones aplicables.</p>

  <h2>9. Revisión de esta política</h2>
  <p>OPAL BAR revisa estos estándares al menos una vez al año, o antes si surgen cambios regulatorios o nuevas amenazas de seguridad infantil. La versión vigente es siempre la publicada en esta URL.</p>

  <h2>10. Contacto general y reportes urgentes</h2>
  <p>Para cualquier consulta sobre esta política o para reportar incidentes urgentes de seguridad infantil que requieran atención inmediata fuera del flujo de denuncia in-app:</p>
  <ul>
    <li>Correo electrónico: <a href="mailto:carlosalonsog966@gmail.com">carlosalonsog966@gmail.com</a></li>
    <li>En caso de emergencia que involucre riesgo inmediato a un menor, contacte primero a las autoridades locales (911 en México y Estados Unidos).</li>
  </ul>

  <div class="meta">
    <p><strong>Última actualización:</strong> 30 de abril de 2026</p>
    <p><strong>Versión:</strong> 1.0</p>
    <p>OPAL BAR — Puerto Vallarta, Jalisco, México</p>
  </div>
  `,
);
