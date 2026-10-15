import { useEffect, useRef, type RefObject } from "react"

/**
 * Baixa fins al final quan arriba text nou, però només si ja s'hi era: si l'usuari ha pujat a llegir (també mentre
 * escriu la resposta), no se l'estira avall. `atBottom` el posa a `true` qui envia un missatge (es torna a seguir el final).
 */
export function useChatScroll(items: unknown, atBottom: RefObject<boolean>) {
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = list.current
    if (el && atBottom.current) el.scrollTop = el.scrollHeight
  }, [items, atBottom])
  const onListScroll = () => {
    const el = list.current
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }
  return { list, onListScroll }
}
