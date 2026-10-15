import { useState } from "react"

/** Assistent personal: el calaix (muntat el primer cop que s'obre), obert o tancat. */
export function useAssistantDrawer() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  // El botó «Assistent» l'obre i, si ja és obert, el tanca (com la ✕: si hi ha conversa, ho pregunta).
  const [closeRequest, setCloseRequest] = useState(0)
  const toggle = () => {
    if (open) return setCloseRequest((n) => n + 1)
    setMounted(true)
    setOpen(true)
  }
  const close = () => setOpen(false)
  return { open, mounted, closeRequest, toggle, close }
}
