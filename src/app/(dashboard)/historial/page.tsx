import { redirect } from "next/navigation"

// Historial se fusionó dentro de Balance — este redirect evita un 404 a quien
// tenga el link viejo guardado.
export default function HistorialPage() {
  redirect("/balance")
}
