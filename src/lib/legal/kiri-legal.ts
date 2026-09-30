/**
 * Documentos que acepta quien usa Kiri Finance: Términos y Condiciones de Uso
 * y Autorización para el Tratamiento de Datos Personales (Ley 1581 de 2012).
 *
 * La VERSIÓN se envía con la aceptación y queda guardada en Authoriza
 * (user_consents) con fecha, IP y navegador. Si cambia el texto, cambia la
 * versión: a quien aceptó una versión anterior Kiri le vuelve a pedir la
 * aceptación al entrar. El backend valida las mismas versiones
 * (Backend_AidCash/src/lib/legal.ts): mantenerlas iguales.
 */

export const LEGAL_VERSIONS = {
  terms: "kiri-terminos-2026-09-30",
  habeasData: "kiri-datos-2026-09-30",
} as const

export type LegalDocKey = "terminos" | "datos"

export interface LegalSection {
  heading: string
  paragraphs?: string[]
  items?: string[]
}

export interface LegalDocument {
  key: LegalDocKey
  title: string
  version: string
  updated: string
  intro: string
  sections: LegalSection[]
}

export const CONTACT_EMAIL = "ti.cyclonet@hotmail.com"

export const KIRI_TERMS: LegalDocument = {
  key: "terminos",
  title: "Términos y Condiciones de Uso de Kiri Finance",
  version: LEGAL_VERSIONS.terms,
  updated: "30 de septiembre de 2026",
  intro:
    "Kiri Finance (\"Kiri\") es una aplicación de finanzas personales operada por CycloNet S.A.S. Te ayuda a registrar y " +
    "organizar tus ingresos, gastos, deudas y ahorros. Al crear tu cuenta o seguir usando Kiri aceptas estos términos.",
  sections: [
    {
      heading: "1. Qué es y qué no es Kiri",
      items: [
        "Kiri es una herramienta de registro, organización y seguimiento de tus finanzas. Los saldos, billeteras y bolsillos de Kiri son registros que tú llevas: Kiri no recibe, guarda, transfiere ni custodia dinero.",
        "Kiri no es un banco, una entidad financiera, vigilada por la Superintendencia Financiera, ni un asesor financiero, tributario o de inversiones. Los consejos, proyecciones, simulaciones y respuestas de Kiri Coach son orientativos y educativos: las decisiones sobre tu dinero son tuyas.",
        "Los cálculos dependen de la información que registras. Si la información está incompleta o desactualizada, los resultados también lo estarán.",
      ],
    },
    {
      heading: "2. Tu cuenta",
      items: [
        "Debes ser mayor de 18 años y registrar información veraz, completa y actualizada.",
        "La cuenta se activa al confirmar tu correo electrónico. Es personal e intransferible y debes mantener tu contraseña en reserva; eres responsable de lo que se haga con ella.",
        "Tu cuenta es la misma para el ecosistema CycloNet (Authoriza): con el mismo correo y contraseña entras a FactoNet para ver contratos y facturas.",
      ],
    },
    {
      heading: "3. Kiri Coach, dictado y escáner (inteligencia artificial)",
      items: [
        "Kiri Coach, el dictado por voz y el escáner de recibos usan un proveedor de inteligencia artificial. Pueden equivocarse o interpretar mal un dato: Kiri siempre te muestra lo que propone registrar y nada se guarda hasta que lo confirmas.",
        "Revisa lo que confirmas. CycloNet S.A.S. no responde por decisiones tomadas únicamente con base en respuestas de la IA.",
        "Cada plan incluye un número de usos de IA al mes, que se renueva el día 1.",
      ],
    },
    {
      heading: "4. Social: conexiones, préstamos y compartidos",
      items: [
        "Puedes conectarte con otras personas como Amigo, Familia o Pareja. Según el rol y lo que tú decidas compartir, la otra persona verá información como tu nombre, usuario, foto, bolsillos o deudas compartidas, préstamos entre ustedes y el presupuesto del hogar.",
        "Los préstamos, abonos, bolsillos y deudas compartidas son registros acordados entre usuarios. Kiri no presta dinero, no garantiza pagos ni actúa como intermediario financiero; los acuerdos y su cumplimiento son responsabilidad de las partes.",
        "Invita solo a personas que estén de acuerdo en recibir tu invitación.",
      ],
    },
    {
      heading: "5. Planes y pagos",
      items: [
        "KIRI FREE no tiene costo. KIRI PLUS y KIRI PRO son planes pagos, mensuales o anuales, con el precio y los beneficios publicados en \"Mi plan\" al momento de contratar.",
        "Al registrarte tienes 14 días de KIRI PLUS de prueba, sin costo y sin cobro automático al terminar; por cada persona nueva que se registre con tu enlace y verifique su correo ganas 7 días más.",
        "Al cambiarte a un plan pago se genera un contrato que firmas en FactoNet; el nuevo plan se activa al pagar la primera factura. Las facturas se gestionan en Authoriza y se pagan por FactoNet.",
        "Si una factura no se paga a tiempo, el plan pago puede suspenderse hasta el pago. Tus registros no se borran por eso, aunque las funciones del plan pago dejan de estar disponibles mientras tanto.",
        "Como consumidor tienes los derechos que te da la Ley 1480 de 2011, incluido el derecho de retracto cuando aplique.",
      ],
    },
    {
      heading: "6. Uso permitido",
      items: [
        "No uses Kiri para actividades ilegales, para suplantar a otras personas, para registrar información de terceros sin su autorización, ni para acosar a otros usuarios.",
        "No intentes acceder a cuentas ajenas, afectar el funcionamiento de la aplicación ni extraer información de forma automatizada.",
        "CycloNet S.A.S. puede suspender o cancelar las cuentas que incumplan estos términos o la ley.",
      ],
    },
    {
      heading: "7. Disponibilidad y responsabilidad",
      items: [
        "Trabajamos para que Kiri esté disponible y tus datos protegidos, pero puede haber interrupciones por mantenimiento o fallas de terceros (internet, nube, proveedor de IA).",
        "Guarda por tu cuenta los soportes importantes (facturas, comprobantes, contratos). Kiri no reemplaza tus registros contables ni tributarios.",
        "CycloNet S.A.S. responde por el funcionamiento de la aplicación conforme a la ley; no responde por pérdidas derivadas de decisiones financieras tomadas por el usuario ni de acuerdos entre usuarios.",
      ],
    },
    {
      heading: "8. Tus datos",
      paragraphs: [
        "El tratamiento de tus datos personales se rige por la Autorización para el Tratamiento de Datos Personales de Kiri Finance, que aceptas por separado. Puedes cerrar tu cuenta y pedir la supresión de tus datos escribiéndonos.",
      ],
    },
    {
      heading: "9. Cambios, contacto y ley aplicable",
      paragraphs: [
        "Podemos actualizar estos términos; si cambian, Kiri te pedirá aceptarlos de nuevo al entrar y cada aceptación queda registrada con su versión. " +
        `Contacto: ${CONTACT_EMAIL}. Estos términos se rigen por las leyes de la República de Colombia; como consumidor puedes acudir a la Superintendencia de Industria y Comercio.`,
      ],
    },
  ],
}

export const KIRI_HABEAS_DATA: LegalDocument = {
  key: "datos",
  title: "Autorización para el Tratamiento de Datos Personales — Kiri Finance",
  version: LEGAL_VERSIONS.habeasData,
  updated: "30 de septiembre de 2026",
  intro:
    "En cumplimiento de la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013, al marcar la casilla de autorización " +
    "otorgas tu consentimiento previo, expreso e informado para que CycloNet S.A.S. trate tus datos personales como se describe aquí.",
  sections: [
    {
      heading: "1. Responsable",
      paragraphs: [
        `CycloNet S.A.S., operador del ecosistema CycloNet (Authoriza, InOut, FactoNet, SHOTRA y Kiri Finance). Contacto para asuntos de datos personales: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: "2. Datos que tratamos",
      items: [
        "Identificación y contacto: nombres, apellidos, tipo y número de documento, correo electrónico, usuario (@) y foto de perfil.",
        "Información financiera que registras: ingresos y cómo los recibes, gastos, categorías, presupuestos, deudas, obligaciones y gastos fijos, ahorros y bolsillos, préstamos y \"me deben\", y proyecciones.",
        "Contenido que envías a Kiri Coach: mensajes, el texto de lo que dictas y las fotos de recibos o facturas que escaneas.",
        "Social: tus conexiones y su rol (Amigo, Familia, Pareja), invitaciones, bolsillos, deudas y préstamos compartidos, y el presupuesto del hogar.",
        "Si activas la conexión con tu banco (plan PRO): los movimientos y saldos que autorices compartir a través del proveedor de conexión bancaria.",
        "Cuenta y seguridad: credenciales (la contraseña se guarda cifrada en Authoriza), registros de acceso, dirección IP, navegador y dispositivo, y los permisos de notificaciones.",
        "Contratación y facturación: plan, contratos, facturas y pagos.",
        "La información financiera es información personal que tratamos con especial reserva. No pedimos datos sensibles (salud, origen étnico, orientación, creencias, datos biométricos) ni datos de niñas, niños o adolescentes: no los registres en Kiri.",
      ],
    },
    {
      heading: "3. Finalidades",
      items: [
        "Crear y administrar tu cuenta, confirmar tu correo y permitirte el acceso a Kiri y al ecosistema CycloNet.",
        "Prestar las funciones de Kiri: calcular tu disponible, presupuestos, alertas, proyecciones, el Árbol Kiri, misiones y reportes.",
        "Procesar tus mensajes, dictados y fotos de recibos con inteligencia artificial para proponerte registros y responderte.",
        "Mostrar a tus conexiones lo que decidas compartir con ellas en Social.",
        "Enviarte notificaciones en la app, al celular y por correo (vencimientos, préstamos, misiones, facturas y avisos de seguridad).",
        "Gestionar tu plan, contratos, facturación y cobro; atender peticiones, quejas y reclamos; prevenir fraude y proteger la seguridad.",
        "Cumplir obligaciones legales, contables y tributarias, y requerimientos de autoridades.",
        "Elaborar estadísticas internas y anónimas para mejorar Kiri. No vendemos tu información. El envío de publicidad requiere una autorización adicional y separada.",
      ],
    },
    {
      heading: "4. Con quién se comparten",
      items: [
        "Con las personas con las que te conectas en Social, solo en lo que tú compartes con ellas.",
        "Con proveedores que actúan como encargados del tratamiento: infraestructura de nube (Amazon Web Services), inteligencia artificial (Google, para Kiri Coach, dictado y escáner), correo electrónico, notificaciones y, si la activas, conexión bancaria. Solo usan los datos para prestarnos el servicio.",
        "Con las demás aplicaciones de CycloNet, en lo necesario para tu cuenta única y tu facturación (Authoriza y FactoNet).",
        "Con autoridades, cuando la ley lo exija.",
      ],
    },
    {
      heading: "5. Tus derechos",
      items: [
        "Conocer, actualizar y rectificar tus datos.",
        "Solicitar prueba de esta autorización.",
        "Ser informado sobre el uso que se ha dado a tus datos.",
        "Revocar la autorización y/o pedir la supresión de tus datos cuando no exista un deber legal o contractual de conservarlos.",
        "Acceder gratuitamente a tus datos.",
        "Presentar quejas ante la Superintendencia de Industria y Comercio.",
      ],
    },
    {
      heading: "6. Cómo ejercerlos",
      paragraphs: [
        `Escríbenos a ${CONTACT_EMAIL} desde el correo de tu cuenta, con tu nombre, documento y tu solicitud. Las consultas se atienden en máximo 10 días hábiles (prorrogables 5) y los reclamos en máximo 15 días hábiles (prorrogables 8), conforme a los artículos 14 y 15 de la Ley 1581 de 2012.`,
      ],
    },
    {
      heading: "7. Almacenamiento, transmisión y seguridad",
      paragraphs: [
        "Los datos se almacenan en infraestructura de nube ubicada fuera de Colombia (Estados Unidos), y el procesamiento de inteligencia artificial también puede hacerse fuera del país. Al autorizar, aceptas esa transferencia y transmisión internacional a nuestros proveedores, que solo tratan los datos para las finalidades descritas, con medidas de seguridad técnicas y administrativas razonables (conexiones cifradas, acceso restringido y contraseñas cifradas).",
      ],
    },
    {
      heading: "8. Vigencia",
      paragraphs: [
        "Tratamos los datos mientras tengas una cuenta activa y durante el tiempo necesario para cumplir las finalidades y los deberes legales de conservación. Esta autorización queda registrada con su versión, fecha, IP y navegador como prueba.",
      ],
    },
    {
      heading: "9. Declaración",
      paragraphs: [
        "Declaro que leí y comprendí esta autorización, que la información que suministro es veraz, y que autorizo de manera previa, expresa e informada a CycloNet S.A.S. para tratar mis datos personales, incluida mi información financiera, conforme a lo aquí descrito.",
      ],
    },
  ],
}

export function legalDocument(key: string): LegalDocument | null {
  return key === "terminos" ? KIRI_TERMS : key === "datos" ? KIRI_HABEAS_DATA : null
}
