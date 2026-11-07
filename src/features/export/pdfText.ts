import { itemsToLines, type PdfLine, type PdfOutlineItem } from "../../core/pricelist/parse"

/**
 * El text d'un PDF en línies (`core/pricelist/parse.ts`), amb pdf.js (es carrega només en llegir una tarifa), i els
 * capítols de l'índex del PDF (marcadors), si en té. Llença un error si el fitxer no és un PDF.
 */
export async function pdfText(data: ArrayBuffer, onPage?: (n: number, total: number) => void): Promise<{ lines: PdfLine[]; outline: PdfOutlineItem[] }> {
  const [pdfjs, { default: workerSrc }] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")])
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  const task = pdfjs.getDocument({ data: new Uint8Array(data) })
  const pdf = await task.promise
  try {
    const outline: PdfOutlineItem[] = []
    const walk = async (items: Awaited<ReturnType<typeof pdf.getOutline>> | null, level: number) => {
      for (const it of items ?? []) {
        try {
          const dest = typeof it.dest === "string" ? await pdf.getDestination(it.dest) : it.dest
          const ref = dest?.[0]
          if (ref !== undefined && ref !== null) {
            const index = typeof ref === "number" ? ref : await pdf.getPageIndex(ref)
            outline.push({ title: String(it.title ?? "").trim(), page: index + 1 })
          }
        } catch {
          // Un marcador trencat no atura la lectura.
        }
        if (level < 1) await walk(it.items, level + 1)
      }
    }
    await walk(await pdf.getOutline().catch(() => null), 0)

    const lines: PdfLine[] = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const content = await (await pdf.getPage(n)).getTextContent()
      const items = content.items.flatMap((i) =>
        "str" in i && i.str.trim() ? [{ s: i.str, x: i.transform[4] as number, y: i.transform[5] as number, w: i.width || i.str.length * 4, h: Math.abs(i.transform[3] as number) || 8 }] : [],
      )
      lines.push(...itemsToLines(n, items))
      onPage?.(n, pdf.numPages)
    }
    return { lines, outline }
  } finally {
    void task.destroy()
  }
}
