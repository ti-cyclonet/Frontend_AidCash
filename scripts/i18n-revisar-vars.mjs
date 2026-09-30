/**
 * Revisa que los valores {0},{1}… de cada tr("…", [a, b]) sean texto o
 * números: si alguno es un elemento de React (un ícono, un <strong>…) se
 * mostraría "[object Object]". Lista cada caso con archivo:línea.
 *   node scripts/i18n-revisar-vars.mjs
 */
import path from 'node:path'
import ts from 'typescript'

const cfgPath = ts.findConfigFile('.', ts.sys.fileExists, 'tsconfig.json')
const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(cfgPath, ts.sys.readFile).config, ts.sys, path.dirname(cfgPath))
const program = ts.createProgram(cfg.fileNames, cfg.options)
const checker = program.getTypeChecker()
let malos = 0

const esTexto = t => {
  if (t.isUnion()) return t.types.every(esTexto)
  const f = t.flags
  return !!(f & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void | ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.BigIntLike))
}

for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || sf.fileName.includes('node_modules')) continue
  const visitar = n => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'tr' && n.arguments[1] && ts.isArrayLiteralExpression(n.arguments[1])) {
      n.arguments[1].elements.forEach((el, i) => {
        const t = checker.getTypeAtLocation(el)
        if (!esTexto(t)) {
          malos++
          const { line } = sf.getLineAndCharacterOfPosition(el.getStart(sf))
          console.log(`${path.relative('.', sf.fileName)}:${line + 1}  {${i}} = ${el.getText(sf).slice(0, 70)}  (${checker.typeToString(t).slice(0, 60)})`)
        }
      })
    }
    ts.forEachChild(n, visitar)
  }
  visitar(sf)
}
console.log(`\n${malos} valores que no son texto`)
