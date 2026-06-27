import { redirect } from "next/navigation"

/**
 * /deudas redirige a /obligaciones (tab deudas).
 * La gestión de deudas vive en la página de Obligaciones.
 */
export default function DeudasPage() {
  redirect("/obligaciones")
}
