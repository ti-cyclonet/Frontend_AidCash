/**
 * Textos en español que NO pasan por tr() (para revisarlos a mano).
 * Muestra archivo:línea y el texto. Filtra lo que claramente es lógica.
 *   node scripts/i18n-pendientes.mjs [filtro-de-archivo]
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const RAIZ = path.resolve('src')
const filtro = process.argv[2] || ''
const ES = /[áéíóúñ¿¡]|\b(de|la|el|los|las|tu|tus|mi|para|con|sin|por|que|una|un|del|al|este|esta|ya|más|aquí|hoy|mes|días|pago|gasto|ahorro|deuda|plata|registra|registrar|crear|guardar|cancelar|eliminar|tienes|puedes|quedan)\b/i
const listar = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? listar(path.join(d, e.name)) : /\.(tsx?)$/.test(e.name) ? [path.join(d, e.name)] : [])
let n = 0
for (const f of listar(RAIZ)) {
  const rel = path.relative(RAIZ, f).replace(/\\/g, '/')
  if (!rel.includes(filtro) || rel.startsWith('lib/i18n')) continue
  const src = fs.readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const enTr = x => { for (let p = x.parent; p; p = p.parent) { if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 'tr') return true } return false }
  const v = x => {
    let texto = null
    if (ts.isJsxText(x)) texto = x.text.trim()
    else if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) texto = x.text
    else if (ts.isTemplateExpression(x)) texto = x.head.text + x.templateSpans.map(s => ' {} ' + s.literal.text).join('')
    if (texto && texto.includes(' ') && ES.test(texto) && !enTr(x) && !ts.isImportDeclaration(x.parent)
      && !(x.parent && ts.isJsxAttribute(x.parent) && /^(className|href|src|d)$/.test(x.parent.name.getText(sf)))
      && !/^(text-|bg-|border|flex|grid|h-|w-|p-|m-|rounded|absolute|relative|inline|block|hidden|shadow|font-|space-|gap-|items-|justify-)/.test(texto)) {
      const { line } = sf.getLineAndCharacterOfPosition(x.getStart(sf))
      console.log(`${rel}:${line + 1}  ${texto.replace(/\s+/g, ' ').slice(0, 110)}`)
      n++
      if (ts.isTemplateExpression(x)) return
    }
    ts.forEachChild(x, v)
  }
  v(sf)
}
console.log(`\n${n} textos sin tr()`)
