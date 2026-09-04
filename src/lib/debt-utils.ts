import type { Debt } from "@/lib/types"

/**
 * Determina si una deuda es una tarjeta de crédito.
 *
 * Único lugar donde vive esta regla — antes estaba copiada de forma
 * inconsistente en 6+ sitios (CreditCardSelector, varios filtros inline en
 * obligaciones/page.tsx, el formulario de alta), cada uno con su propia
 * lista de palabras. El resultado: una tarjeta con tipoDeuda=TARJETA_CREDITO
 * pero un nombre que no calzaba con ninguna lista podía desaparecer como
 * opción de pago con TC en un botón y sí aparecer en otro; un préstamo
 * llamado "Crédito Hipotecario" podía colarse como tarjeta por la palabra
 * "credito". Prioriza siempre el campo del modelo; el nombre es solo un
 * fallback para deudas legacy sin tipoDeuda bien clasificado.
 */
export function isCreditCard(debt: Pick<Debt, "tipoDeuda" | "nombre">): boolean {
  return debt.tipoDeuda === "TARJETA_CREDITO" || looksLikeCreditCardName(debt.nombre)
}

/**
 * El nombre solo, sin campo tipoDeuda — usado tanto como fallback de
 * isCreditCard() como para PRE-CLASIFICAR tipoDeuda al crear una deuda nueva
 * (DebtRegistrationForm), para que el mismo nombre siempre se clasifique
 * igual sin importar en qué momento se evalúe.
 *
 * OJO: a propósito NO incluye "credito"/"crédito" sueltos — esa palabra es
 * justo la que hacía que un préstamo llamado "Crédito Hipotecario" se colara
 * como tarjeta en una de las versiones antiguas de este chequeo.
 */
export function looksLikeCreditCardName(nombre: string): boolean {
  const lower = nombre.toLowerCase()
  return (
    lower.includes("tarjeta") ||
    lower.includes("tc ") ||
    lower.includes("visa") ||
    lower.includes("mastercard") ||
    lower.includes("amex")
  )
}
