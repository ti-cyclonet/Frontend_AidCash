/**
 * Palabras sueltas en español que quedan sin traducir: texto de JSX sin tr()
 * y literales dentro de los valores de un tr("…", [ … ]).
 *   node scripts/i18n-sueltas.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const RAIZ = path.resolve('src')
const listar = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? listar(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : [])
let n = 0
for (const f of listar(RAIZ)) {
  const rel = path.relative(RAIZ, f).replace(/\\/g, '/')
  if (rel.startsWith('lib/i18n')) continue
  const src = fs.readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const enTr = x => { for (let p = x.parent; p; p = p.parent) { if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 'tr') return p; if (ts.isSourceFile(p)) break } return null }
  const linea = x => sf.getLineAndCharacterOfPosition(x.getStart(sf)).line + 1
  const v = x => {
    if (ts.isJsxText(x)) {
      const t = x.text.replace(/\s+/g, ' ').trim()
      if (/[a-záéíóúñ]{2,}/i.test(t) && !/^[A-Z0-9 .,:·/%-]+$/.test(t)) { console.log(`${rel}:${linea(x)}  JSX  «${t}»`); n++ }
    }
    if ((ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) && /^[a-záéíóúñ ]{3,}$/i.test(x.text)) {
      const call = enTr(x)
      if (call && call.arguments[0] !== x && !(ts.isCallExpression(x.parent) && ts.isIdentifier(x.parent.expression) && x.parent.expression.text === 'tr')) { console.log(`${rel}:${linea(x)}  VAR  «${x.text}»`); n++ }
    }
    ts.forEachChild(x, v)
  }
  v(sf)
}
console.log(`\n${n} casos`)
