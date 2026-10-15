import { useEffect, useRef, useState, type DragEvent } from "react"
import { attachKind, MAX_PDF_BYTES } from "../attachments"
import type { Attached } from "./types"

/**
 * Els fitxers adjunts del missatge que s'escriu: amb el clip (`fileInput`) o deixant-los anar a sobre del panell
 * (`dropProps`), l'avís dels que no es poden adjuntar i les miniatures de les fotos.
 */
export function useChatAttachments() {
  const [attached, setAttached] = useState<Attached[]>([])
  const [attachNote, setAttachNote] = useState<string | null>(null)
  // Arrossegant fitxers a sobre del panell (comptador: dragenter/dragleave salten a cada fill).
  const [dragOver, setDragOver] = useState(false)
  const dragDepth = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  // Les fotos de la conversa (URL de blob) s'alliberen en sortir de l'Editor.
  const urls = useRef<string[]>([])
  useEffect(() => {
    const own = urls.current
    return () => own.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  const attach = (files: Iterable<File>) => {
    const ok: Attached[] = []
    const skipped: string[] = []
    for (const file of files) {
      const kind = attachKind(file)
      if (!kind || (kind === "pdf" && file.size > MAX_PDF_BYTES)) {
        skipped.push(kind ? `${file.name} (més de 30 MB)` : file.name)
        continue
      }
      let url: string | undefined
      if (kind === "image") {
        url = URL.createObjectURL(file)
        urls.current.push(url)
      }
      ok.push({ kind, ...(url ? { url } : {}), blob: file, name: file.name })
    }
    if (ok.length) setAttached((xs) => [...xs, ...ok])
    setAttachNote(skipped.length ? `No es pot adjuntar: ${skipped.join(", ")}. Només fotos, PDF i fitxers de text.` : null)
    if (fileInput.current) fileInput.current.value = ""
  }
  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files")
  const dropProps = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current++
      setDragOver(true)
    },
    onDragOver: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
    },
    onDragLeave: (e: DragEvent) => {
      if (!hasFiles(e)) return
      if (--dragDepth.current <= 0) {
        dragDepth.current = 0
        setDragOver(false)
      }
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current = 0
      setDragOver(false)
      attach(Array.from(e.dataTransfer.files))
    },
  }
  /** Treu un adjunt (per posició). */
  const remove = (k: number) => setAttached((xs) => xs.filter((_, i) => i !== k))
  /** Buida els adjunts i l'avís (en enviar o començar de nou). */
  const clear = () => {
    setAttached([])
    setAttachNote(null)
  }
  return { attached, attachNote, dragOver, dropProps, fileInput, attach, remove, clear }
}
