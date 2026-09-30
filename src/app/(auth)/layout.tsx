import { SelectorIdioma } from "@/components/i18n/SelectorIdioma"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<SelectorIdioma /></>
}
