/**
 * Quita tr() de lo que NO es texto para el usuario (CSS, parámetros de URL,
 * cabeceras, errores de programación y listas de palabras clave con las que
 * la app RECONOCE lo que escribe el usuario). Deja el literal original.
 *   node scripts/i18n-desenvolver.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const RAIZ = path.resolve('src')
const TECNICO = [
  /rgba?\(|gradient\(|cubic-bezier|drop-shadow|saturate\(|brightness\(|translate[XY]?\(|scale\(|rotate\(/,
  /\b\d*\.?\d+m?s\b.*\b(ease|linear|infinite|forwards|both|alternate)\b|\b(ease|linear)(-in|-out|-in-out)?\b.*\d+m?s/,
  /^kiri[A-Z]\w+ /, /path=\/|max-age=|timeframe=|partnerId=|&from=|^Bearer /,
  /must be used|should be used|debe usarse|must be used inside|IndexedDB no disponible/,
  /^\{0\}-\{1\}-Q\{2\}$/, /^\{0\}=\{1\}/, /\[&>svg|peer\/menu-button|stroke-dashoffset/, /--color-|\[data-chart=/,
]
// Listas de palabras clave: se comparan con lo que escribe el usuario (no se muestran)
const POR_ARCHIVO = {
  'lib/hormiga.ts': () => true,
  'hooks/use-budget-categories.ts': (k, n) => ts.isArrayLiteralExpression(n.parent), // palabras clave por categoría
  'lib/obligation-icons.tsx': k => !/[⚡🔥]/.test(k),
  'components/gestion/PresupuestoTab.tsx': (k, n) => k === 'café' && ts.isArrayLiteralExpression(n.parent),
  'lib/recommendations.ts': k => k === 'Bola de Nieve' || k === 'Avalancha',
}

const listar = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? listar(path.join(d, e.name)) : /\.(tsx?)$/.test(e.name) ? [path.join(d, e.name)] : [])
let total = 0
for (const f of listar(RAIZ)) {
  const rel = path.relative(RAIZ, f).replace(/\\/g, '/')
  const src = fs.readFileSync(f, 'utf8')
  if (!src.includes('tr(')) continue
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const edits = []
  const v = n => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'tr' && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
      const k = n.arguments[0].text
      const quitar = TECNICO.some(r => r.test(k)) || (POR_ARCHIVO[rel]?.(k, n) ?? false)
      if (quitar) {
        const vars = n.arguments[1] && ts.isArrayLiteralExpression(n.arguments[1]) ? n.arguments[1].elements.map(e => e.getText(sf)) : []
        const esc = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
        const texto = vars.length
          ? '`' + esc(k).replace(/\{(\d+)\}/g, (_, i) => '${' + vars[Number(i)] + '}') + '`'
          : JSON.stringify(k)
        // Dentro de JSX como hijo {tr("…")} el literal sigue siendo válido: {"…"}
        edits.push({ i: n.getStart(sf), f: n.getEnd(), t: texto })
        return
      }
    }
    ts.forEachChild(n, v)
  }
  v(sf)
  if (!edits.length) continue
  let out = src
  for (const e of edits.sort((a, b) => b.i - a.i)) out = out.slice(0, e.i) + e.t + out.slice(e.f)
  // Atributo JSX que quedó como attr={"texto"} → attr="texto"
  out = out.replace(/=\{("(?:[^"\\]|\\.)*")\}/g, (m, lit) => TECNICO.some(r => r.test(JSON.parse(lit))) ? '=' + lit : m)
  // Si ya no se usa tr en el archivo, quitarlo del import
  if (!/\btr\(/.test(out.replace(/import[^\n]*\n/g, ''))) {
    out = out.replace(/import \{([^}]*)\} from "@\/lib\/i18n"\n?/, (m, names) => {
      const resto = names.split(',').map(s => s.trim()).filter(x => x && x !== 'tr')
      return resto.length ? `import { ${resto.join(', ')} } from "@/lib/i18n"\n` : ''
    })
  }
  fs.writeFileSync(f, out)
  total += edits.length
  console.log(`${rel}: ${edits.length}`)
}
console.log(`\nQuitados ${total} tr() de texto técnico`)
