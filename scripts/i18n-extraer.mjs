/**
 * Lista los textos de tr("…") que aún no tienen traducción al inglés.
 *   node scripts/i18n-extraer.mjs            → resumen
 *   node scripts/i18n-extraer.mjs --json f   → escribe los faltantes en f (clave → [archivos])
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const RAIZ = path.resolve('src')
const enSrc = fs.readFileSync(path.join(RAIZ, 'lib/i18n-en.ts'), 'utf8')
const enSf = ts.createSourceFile('en.ts', enSrc, ts.ScriptTarget.Latest, true)
const EN = new Set()
const mirarEn = n => { if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.name) || ts.isIdentifier(n.name))) EN.add(n.name.text); ts.forEachChild(n, mirarEn) }
mirarEn(enSf)

const claves = new Map()
const listar = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? listar(path.join(d, e.name)) : /\.(tsx?)$/.test(e.name) ? [path.join(d, e.name)] : [])
for (const f of listar(RAIZ)) {
  const src = fs.readFileSync(f, 'utf8')
  if (!src.includes('tr(')) continue
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const v = n => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'tr' && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))) {
      const k = n.arguments[0].text
      if (!claves.has(k)) claves.set(k, new Set())
      claves.get(k).add(path.relative(RAIZ, f).replace(/\\/g, '/'))
    }
    ts.forEachChild(n, v)
  }
  v(sf)
}
const faltan = [...claves.keys()].filter(k => !EN.has(k))
const sobran = [...EN].filter(k => !claves.has(k))
console.log(`Textos: ${claves.size} · traducidos: ${claves.size - faltan.length} · faltan: ${faltan.length} · en el diccionario sin usar: ${sobran.length}`)
const i = process.argv.indexOf('--json')
if (i > 0) {
  const out = {}
  for (const k of faltan) out[k] = [...claves.get(k)]
  fs.writeFileSync(process.argv[i + 1], JSON.stringify(out, null, 1))
  console.log('Escrito', process.argv[i + 1])
}
