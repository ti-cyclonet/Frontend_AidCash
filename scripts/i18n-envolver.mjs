/**
 * Envuelve en tr() los textos VISIBLES de la app (para traducirla).
 *
 *   node scripts/i18n-envolver.mjs            → aplica los cambios
 *   node scripts/i18n-envolver.mjs --revisar  → solo muestra qué cambiaría
 *
 * Solo toca texto que el usuario ve: texto dentro de JSX, atributos como
 * placeholder/title/aria-label, y literales que terminan en JSX, en
 * propiedades de mensajes (title, description, message, label…), en
 * set*Error/toast(), en returns y en variables tipo `titulo`/`mensaje`.
 * Nunca valores de lógica ("gasto", "salario"…): solo frases con pinta de
 * texto humano. Es idempotente (lo que ya está en tr() no se vuelve a tocar).
 * Las fechas "es-CO" pasan a localeFecha().
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const RAIZ = path.resolve('src')
const REVISAR = process.argv.includes('--revisar')
const EXCLUIR = new Set(['lib/i18n.ts', 'lib/i18n-en.ts', 'app/layout.tsx'])

const ATTR_NO = new Set(['className', 'id', 'key', 'href', 'src', 'type', 'name', 'value', 'variant', 'size', 'role', 'htmlFor',
  'inputMode', 'autoComplete', 'mode', 'module', 'feature', 'tabId', 'method', 'target', 'rel', 'accept', 'pattern', 'dir',
  'align', 'side', 'orientation', 'defaultValue', 'color', 'fill', 'stroke', 'd', 'viewBox', 'transform', 'gradientTransform',
  'offset', 'stopColor', 'strokeLinecap', 'strokeLinejoin', 'dataKey', 'stackId', 'layout', 'ref', 'form', 'lang', 'capture',
  'xmlns', 'points', 'textAnchor', 'dominantBaseline', 'fontFamily', 'ojos', 'tipo', 'estado', 'frequency', 'incomeFrequency'])
const PROP_SI = new Set(['title', 'description', 'message', 'label', 'desc', 'subtitle', 'text', 'placeholder', 'texto', 'titulo',
  'mensaje', 'descripcion', 'navBlurb', 'body', 'hint', 'detalle', 'tooltip', 'error', 'cta', 'ctaLabel', 'heading', 'subtitulo',
  'pregunta', 'respuesta', 'etiqueta', 'resumen', 'motivo', 'aviso', 'titleAccion', 'condicion', 'd', 't', 'sub', 'info', 'nota',
  'boton', 'accion', 'explicacion', 'consejo', 'tip', 'tipoLabel', 'estadoLabel', 'periodoLabel', 'ayuda', 'vacio', 'nombre', 'msg', 'frase', 'leyenda', 'status', 'banner', 'dialogo'])
const FUNC_SI = /^(set\w*(Error|Msg|Mensaje|Aviso|Resultado|Titulo|Texto|Info|Nota|Estado)\w*|toast|alert|confirm|setPushMsg|setVoiceError|setScanError|setObligationError|setErrorCambio|setUsernameError|setAvatarError)$/
// Métodos donde un texto es lógica (buscar, comparar, guardar), nunca algo que se muestra
const LLAMADA_NO = new Set(['log', 'warn', 'info', 'debug', 'cn', 'clsx', 'twMerge', 'fetch', 'api', 'getItem', 'setItem', 'removeItem',
  'addEventListener', 'removeEventListener', 'dispatchEvent', 'CustomEvent', 'Event', 'querySelector', 'querySelectorAll', 'matchMedia',
  'RegExp', 'parse', 'stringify', 'includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'split', 'replace', 'replaceAll',
  'test', 'match', 'matchAll', 'search', 'localeCompare', 'padStart', 'padEnd', 'join', 'get', 'has', 'set', 'delete', 'emit', 'on',
  'off', 'push' /* se decide abajo */, 'setProperty', 'getPropertyValue', 'setAttribute', 'getAttribute', 'createElement', 'open', 'postMessage', 'importScripts'])
const PROP_VISIBLE = /(label|Label|titulo|Titulo|mensaje|Mensaje|message|Message|texto|Texto|desc|Desc|nombre|Nombre|title|Title|name$|Name$|hint|Hint|reason|Reason|razon|Razon|positivo|Positivo|negativo|Negativo|subtitle|Subtitle|caption|Caption)/
const PROP_NO = /(class|Class|color|Color|ring|Ring|route|Route|url|Url|href|icon|Icon|emoji|key$|Key$|^id$|Id$|tipo|status$|strategy$|variant|tag$|event|Event|path|Path|query|Query|endpoint|method)/
const conFrase = t => /\s|[áéíóúñ¿¡]/.test(t ?? '')
const VAR_SI = /^(t[ií]tulo|texto|mensaje|msg|label|etiqueta|desc|descripcion|subtitulo|aviso|motivo|detalle|placeholder|resumen|frase|leyenda|explicacion|consejo|nota)/i

/** ¿Parece texto para personas (y no un valor de lógica, clase CSS o ruta)? */
function esHumano(s) {
  const x = s.trim()
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(x)) return false
  if (/^(\/|https?:|#|\.|@\/|data:|mailto:)/.test(x)) return false
  if (/^[MLHVCSQTAZmlhvcsqtaz0-9.,\s-]+$/.test(x) && /\d/.test(x)) return false   // trazos SVG
  if (/^[\w.-]+@[\w.-]+$/.test(x)) return false                                  // correos
  if (/[áéíóúñÁÉÍÓÚÑ¿¡]/.test(x)) return true
  const tokens = x.split(/\s+/)
  if (tokens.length === 1) {
    const w = tokens[0]
    if (w === w.toUpperCase()) return false          // ENUM, OK, PRO
    if (/^[a-z]/.test(w)) return false               // gasto, aiCoach, text-sm
    if (/[_\-:\/.]/.test(w.replace(/[.!?,;:)]$/, ''))) return false
    return /^[A-Z][a-z]+[!?.:,]?$/.test(w)           // "Guardar", "Cancelar"
  }
  // Varias palabras: descartar listas de clases/estilos ("text-sm font-bold")
  const pareceClase = tokens.every(w => /^[a-z0-9\-:\/\[\]\.%#_!>&=+*()]+$/.test(w)) && tokens.some(w => /[-:\[\/\d]/.test(w))
  if (pareceClase) return false
  if (tokens.every(w => /^[a-z0-9_]+$/.test(w)) && tokens.length <= 2 && !/\b(de|la|el|en|y|a|tu|mi|no|sin|con|por|al|del)\b/.test(x)) return false
  return true
}

const ENTIDADES = { '&ldquo;': '“', '&rdquo;': '”', '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&hellip;': '…', '&mdash;': '—', '&ndash;': '–', '&lsquo;': '‘', '&rsquo;': '’', '&laquo;': '«', '&raquo;': '»', '&#39;': "'" }
const decodificar = s => s.replace(/&[a-z#0-9]+;/gi, e => ENTIDADES[e] ?? e)

/** Valor de un texto JSX según las reglas de React (líneas recortadas y unidas con espacio). */
function valorJsx(raw) {
  const lineas = raw.split(/\r?\n/)
  if (lineas.length === 1) return raw
  const partes = []
  lineas.forEach((l, i) => {
    let v = l
    if (i > 0) v = v.replace(/^\s+/, '')
    if (i < lineas.length - 1) v = v.replace(/\s+$/, '')
    if (v) partes.push(v)
  })
  return partes.join(' ')
}

function listarArchivos(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listarArchivos(p))
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

let totalCambios = 0
const saltados = []

for (const archivo of listarArchivos(RAIZ)) {
  const rel = path.relative(RAIZ, archivo).replace(/\\/g, '/')
  if (EXCLUIR.has(rel)) continue
  const src = fs.readFileSync(archivo, 'utf8')
  // Componentes de servidor (sin "use client") dentro de app/: el idioma es del navegador
  if (rel.startsWith('app/') && !/^\s*["']use client["']/.test(src) && /\.tsx$/.test(rel)) {
    if (/[áéíóúñ¿¡]/.test(src)) saltados.push(rel)
    continue
  }
  const sf = ts.createSourceFile(archivo, src, ts.ScriptTarget.Latest, true, archivo.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  let edits = [] // { inicio, fin, texto }
  let usaTr = false, usaLocale = false

  const textoCon = (inicio, fin) => {
    // Fuente de [inicio, fin) con las ediciones internas aplicadas (y consumidas)
    const dentro = edits.filter(e => e.inicio >= inicio && e.fin <= fin).sort((a, b) => b.inicio - a.inicio)
    edits = edits.filter(e => !(e.inicio >= inicio && e.fin <= fin))
    let s = src.slice(inicio, fin)
    for (const e of dentro) s = s.slice(0, e.inicio - inicio) + e.texto + s.slice(e.fin - inicio)
    return s
  }

  const dentroDeTr = n => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 'tr') return true
      if (ts.isSourceFile(p)) break
    }
    return false
  }

  const textoDe = x => ts.isTemplateExpression(x) ? x.head.text + x.templateSpans.map(s => ' ' + s.literal.text).join('') : (x.text ?? '')

  /** ¿El literal termina mostrándose? (sube por ternarios, &&, ||, ??, paréntesis) */
  function contextoVisible(n) {
    let hijo = n, p = n.parent
    while (p) {
      if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p)) { hijo = p; p = p.parent; continue }
      if (ts.isConditionalExpression(p)) { if (p.condition === hijo) return false; hijo = p; p = p.parent; continue }
      if (ts.isBinaryExpression(p)) {
        const op = p.operatorToken.kind
        if ((op === ts.SyntaxKind.AmpersandAmpersandToken && p.right === hijo) || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) { hijo = p; p = p.parent; continue }
        if (op === ts.SyntaxKind.PlusToken) { hijo = p; p = p.parent; continue }
        // mensaje = "…"  (asignación de una frase)
        if (op === ts.SyntaxKind.EqualsToken && p.right === hijo) return conFrase(textoDe(n))
        return false
      }
      if (ts.isTemplateSpan(p)) { return contextoVisible(p.parent) }
      if (ts.isJsxExpression(p)) {
        const a = p.parent
        if (ts.isJsxAttribute(a)) { const nom = a.name.getText(sf); return !ATTR_NO.has(nom) && !nom.startsWith('data-') && !nom.startsWith('on') }
        return true
      }
      if (ts.isPropertyAssignment(p)) {
        if (p.initializer !== hijo) return false
        const clave = p.name.getText(sf).replace(/['"]/g, '')
        if (PROP_SI.has(clave) || PROP_VISIBLE.test(clave)) return true
        if (!PROP_NO.test(clave) && conFrase(textoDe(n))) return true
        // Mapas de etiquetas: { PENDING: "Esperando aprobación", ACTIVE: "Activo" }
        const obj = p.parent
        const vals = obj.properties.filter(ts.isPropertyAssignment).map(x => x.initializer)
        return vals.length >= 2 && vals.every(v => (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) && esHumano(v.text))
      }
      if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
        if (!p.arguments?.includes(hijo)) return false
        const c = p.expression
        const nom = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : ''
        if (ts.isNewExpression(p) && nom === 'Error') return esHumano(n.text ?? '') // errores que ve el usuario
        if (FUNC_SI.test(nom)) return true
        const callee = c.getText(sf)
        if (callee.startsWith('console.') || callee === 'tr') return false
        // f.push("Escribe el monto") en listas de mensajes; doc.text("…") del PDF; etc.
        if (nom === 'push') return conFrase(textoDe(n)) && /[A-ZÁÉÍÓÚ¿¡]/.test(textoDe(n).trim()[0] ?? '')
        return !LLAMADA_NO.has(nom) && conFrase(textoDe(n))
      }
      if (ts.isReturnStatement(p)) return true
      if (ts.isArrowFunction(p)) return p.body === hijo
      if (ts.isVariableDeclaration(p)) {
        if (p.initializer !== hijo || !ts.isIdentifier(p.name)) return false
        if (VAR_SI.test(p.name.text)) return true
        // Cualquier variable que guarda una frase (con espacios o tildes)
        return n.kind !== ts.SyntaxKind.TemplateExpression ? /\s|[áéíóúñ¿¡]/.test(n.text ?? '') : true
      }
      if (ts.isParameter(p) || ts.isBindingElement(p)) return p.initializer === hijo && /\s|[áéíóúñ¿¡]/.test(n.text ?? '')
      if (ts.isArrayLiteralExpression(p)) {
        // Listas de frases: ["Vamos bien", "Sigue así"]
        const strs = p.elements.filter(e => ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e))
        if (strs.length >= 2 && strs.length === p.elements.length && strs.every(e => esHumano(e.text))) return true
        hijo = p; p = p.parent; continue
      }
      return false
    }
    return false
  }

  function envolverLiteral(n) {
    if (dentroDeTr(n)) return
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      if (!esHumano(n.text)) return
      if (ts.isJsxAttribute(n.parent)) return // se maneja aparte
      edits.push({ inicio: n.getStart(sf), fin: n.getEnd(), texto: `tr(${JSON.stringify(n.text)})` })
      usaTr = true
      return
    }
    if (ts.isTemplateExpression(n)) {
      let clave = n.head.text
      const vars = []
      n.templateSpans.forEach((s, i) => { clave += `{${i}}` + s.literal.text; vars.push(s.expression) })
      if (!esHumano(clave.replace(/\{\d+\}/g, ' '))) return
      const txtVars = vars.map(v => textoCon(v.getStart(sf), v.getEnd()))
      edits.push({ inicio: n.getStart(sf), fin: n.getEnd(), texto: `tr(${JSON.stringify(clave)}, [${txtVars.join(', ')}])` })
      usaTr = true
    }
  }

  function esSimple(expr) {
    // Una expresión de JSX que puede ir como {0} dentro de una frase (sin JSX adentro)
    let ok = true
    const mirar = x => { if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x) || ts.isArrowFunction(x) || ts.isFunctionExpression(x)) ok = false; else ts.forEachChild(x, mirar) }
    if (!expr) return false
    mirar(expr)
    return ok
  }

  function procesarHijosJsx(nodo) {
    const hijos = nodo.children
    let i = 0
    while (i < hijos.length) {
      // Tramo de texto + {expresiones simples}
      if (!ts.isJsxText(hijos[i]) && !(ts.isJsxExpression(hijos[i]) && esSimple(hijos[i].expression))) { i++; continue }
      let j = i
      while (j < hijos.length && (ts.isJsxText(hijos[j]) || (ts.isJsxExpression(hijos[j]) && esSimple(hijos[j].expression)))) j++
      const tramo = hijos.slice(i, j)
      const hayTexto = tramo.some(h => ts.isJsxText(h) && esHumano(decodificar(valorJsx(h.text)).replace(/^[\s.,;:·—–)\]]+/, '')))
      if (hayTexto) {
        let clave = '', vars = [], lead = '', trail = ''
        tramo.forEach((h, k) => {
          if (ts.isJsxText(h)) {
            let v = decodificar(valorJsx(h.text))
            if (k === 0) { lead = v.match(/^\s*/)[0]; v = v.slice(lead.length) }
            if (k === tramo.length - 1) { trail = v.match(/\s*$/)[0]; v = v.slice(0, v.length - trail.length) }
            clave += v
          } else if (h.expression) {
            clave += `{${vars.length}}`
            vars.push(textoCon(h.expression.getStart(sf), h.expression.getEnd()))
          }
        })
        const inicio = tramo[0].getStart(sf, true) < tramo[0].pos ? tramo[0].pos : tramo[0].pos
        const fin = tramo[tramo.length - 1].getEnd()
        textoCon(inicio, fin) // consumir ediciones internas ya incorporadas
        const sigSp = s => (s.includes('\n') || !s) ? '' : '{" "}'
        const expr = vars.length ? `tr(${JSON.stringify(clave)}, [${vars.join(', ')}])` : `tr(${JSON.stringify(clave)})`
        edits.push({ inicio, fin, texto: `${sigSp(lead)}{${expr}}${sigSp(trail)}` })
        usaTr = true
      }
      i = j
    }
  }

  function visitar(n) {
    ts.forEachChild(n, visitar)
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) { procesarHijosJsx(n); return }
    if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer)) {
      const nom = n.name.getText(sf)
      if (!ATTR_NO.has(nom) && !nom.startsWith('data-') && esHumano(n.initializer.text)) {
        edits.push({ inicio: n.initializer.getStart(sf), fin: n.initializer.getEnd(), texto: `{tr(${JSON.stringify(n.initializer.text)})}` })
        usaTr = true
      }
      return
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) && !ts.isJsxAttribute(n.parent) && !ts.isImportDeclaration(n.parent) && !ts.isExportDeclaration(n.parent) && !ts.isLiteralTypeNode(n.parent)) {
      if (contextoVisible(n)) envolverLiteral(n)
      return
    }
    // Fechas: "es-CO" → localeFecha()
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const m = n.expression.name.text
      const a0 = n.arguments[0]
      const esFecha = m === 'toLocaleDateString' || m === 'toLocaleTimeString'
        || (m === 'toLocaleString' && n.arguments[1] && /\b(month|day|weekday|hour|minute|year)\b/.test(n.arguments[1].getText(sf)))
      if (esFecha && a0 && ts.isStringLiteral(a0) && /^es(-|$)/.test(a0.text)) {
        edits.push({ inicio: a0.getStart(sf), fin: a0.getEnd(), texto: 'localeFecha()' })
        usaLocale = true
      }
    }
    if (ts.isNewExpression(n) && n.expression.getText(sf) === 'Intl.DateTimeFormat' && n.arguments?.[0] && ts.isStringLiteral(n.arguments[0]) && /^es/.test(n.arguments[0].text)) {
      edits.push({ inicio: n.arguments[0].getStart(sf), fin: n.arguments[0].getEnd(), texto: 'localeFecha()' })
      usaLocale = true
    }
  }
  visitar(sf)
  if (!edits.length) continue

  let out = src
  for (const e of [...edits].sort((a, b) => b.inicio - a.inicio)) out = out.slice(0, e.inicio) + e.texto + out.slice(e.fin)

  // Import de tr / localeFecha
  const nombres = [usaTr && !/\btr\b[^\n]*from ["']@\/lib\/i18n["']/.test(src) ? 'tr' : null, usaLocale && !/localeFecha[^\n]*from ["']@\/lib\/i18n["']/.test(src) ? 'localeFecha' : null].filter(Boolean)
  if (nombres.length) {
    const yaImporta = out.match(/import \{([^}]*)\} from ["']@\/lib\/i18n["']/)
    if (yaImporta) {
      const actuales = yaImporta[1].split(',').map(s => s.trim()).filter(Boolean)
      out = out.replace(yaImporta[0], `import { ${[...new Set([...actuales, ...nombres])].join(', ')} } from "@/lib/i18n"`)
    } else {
      const sf2 = ts.createSourceFile(archivo, out, ts.ScriptTarget.Latest, true, archivo.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      const imports = sf2.statements.filter(s => ts.isImportDeclaration(s))
      const pos = imports.length ? imports[imports.length - 1].getEnd() : (out.match(/^\s*["']use client["'];?\s*\n/)?.[0].length ?? 0)
      out = out.slice(0, pos) + `\nimport { ${nombres.join(', ')} } from "@/lib/i18n"` + (imports.length ? '' : '\n') + out.slice(pos)
    }
  }
  totalCambios += edits.length
  if (REVISAR) console.log(`${rel}: ${edits.length}`)
  else fs.writeFileSync(archivo, out)
}
console.log(`\n${REVISAR ? 'Cambiaría' : 'Cambió'} ${totalCambios} textos.`)
if (saltados.length) console.log('Componentes de servidor con texto (revisar a mano):', saltados.join(', '))
