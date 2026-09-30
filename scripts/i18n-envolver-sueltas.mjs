/**
 * Segunda pasada de i18n-envolver: envuelve en tr() las palabras sueltas que
 * la primera deja pasar por prudencia:
 *   - texto de JSX sin tr() («de», «meses», «(opcional)»…);
 *   - palabras que se MUESTRAN dentro de una frase: tr("Racha: {0} {1}", [n, x ? "quincenas" : "meses"]).
 * Nunca toca literales que se comparan (=== "quincenal") ni opciones de formato.
 *   node scripts/i18n-envolver-sueltas.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const RAIZ = path.resolve('src')
const ENT = { '&ldquo;': '“', '&rdquo;': '”', '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&apos;': "'", '&hellip;': '…', '&mdash;': '—', '&#39;': "'" }
const dec = s => s.replace(/&[a-z#0-9]+;/gi, e => ENT[e] ?? e)
const listar = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? listar(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : [])
let total = 0
for (const f of listar(RAIZ)) {
  const rel = path.relative(RAIZ, f).replace(/\\/g, '/')
  if (rel.startsWith('lib/i18n') || rel === 'app/layout.tsx') continue
  const src = fs.readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const edits = []
  const esTr = c => ts.isCallExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === 'tr'
  const v = x => {
    if (ts.isJsxText(x)) {
      const raw = x.text
      // Valor según JSX: líneas recortadas y unidas con espacio
      const lineas = raw.split(/\r?\n/)
      const val = lineas.length === 1 ? raw : lineas.map((l, i) => { let t = l; if (i > 0) t = t.replace(/^\s+/, ''); if (i < lineas.length - 1) t = t.replace(/\s+$/, ''); return t }).filter(Boolean).join(' ')
      const core = dec(val).trim()
      if (/[a-záéíóúñ]{2,}/i.test(core)) {
        // Un espacio al borde solo cuenta en JSX si no lleva salto de línea
        const ini = raw.match(/^\s*/)[0], fin = raw.match(/\s*$/)[0]
        const lead = ini && !ini.includes('\n') ? '{" "}' : ''
        const trail = fin && !fin.includes('\n') ? '{" "}' : ''
        edits.push({ i: x.pos, f: x.end, t: `${lead}{tr(${JSON.stringify(core)})}${trail}` })
      }
    }
    if ((ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) && /[a-záéíóúñ]{2,}/i.test(x.text)) {
      // ¿Se muestra como valor de un tr("…", [ … ])?
      let h = x, p = x.parent, ok = false
      while (p) {
        if (ts.isParenthesizedExpression(p)) { h = p; p = p.parent; continue }
        if (ts.isConditionalExpression(p)) { if (p.condition === h) break; h = p; p = p.parent; continue }
        if (ts.isBinaryExpression(p)) {
          const op = p.operatorToken.kind
          if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken || (op === ts.SyntaxKind.AmpersandAmpersandToken && p.right === h)) { h = p; p = p.parent; continue }
          break
        }
        if (ts.isArrayLiteralExpression(p) && p.parent && esTr(p.parent) && p.parent.arguments[1] === p) ok = true
        break
      }
      if (ok && !esTr(x.parent)) edits.push({ i: x.getStart(sf), f: x.getEnd(), t: `tr(${JSON.stringify(x.text)})` })
    }
    ts.forEachChild(x, v)
  }
  v(sf)
  if (!edits.length) continue
  let out = src
  for (const e of edits.sort((a, b) => b.i - a.i)) out = out.slice(0, e.i) + e.t + out.slice(e.f)
  if (!/import \{[^}]*\btr\b[^}]*\} from "@\/lib\/i18n"/.test(out)) {
    const m = out.match(/import \{([^}]*)\} from "@\/lib\/i18n"/)
    if (m) out = out.replace(m[0], `import { ${[...m[1].split(',').map(s => s.trim()).filter(Boolean), 'tr'].join(', ')} } from "@/lib/i18n"`)
    else {
      const sf2 = ts.createSourceFile(f, out, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      const imps = sf2.statements.filter(ts.isImportDeclaration)
      const pos = imps.length ? imps[imps.length - 1].getEnd() : 0
      out = out.slice(0, pos) + '\nimport { tr } from "@/lib/i18n"' + out.slice(pos)
    }
  }
  fs.writeFileSync(f, out)
  total += edits.length
}
console.log(`Envueltas ${total} palabras sueltas`)
