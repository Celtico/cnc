import { describe, expect, it } from "vitest"
import { compositionDims, STORE_CATALOG } from "./storeCatalog"

const item = (id: string) => STORE_CATALOG.flatMap((c) => c.types.flatMap((t) => t.items)).find((x) => x.id === id)!

describe("mides de la descripció de les plantilles", () => {
  it("la caixa del moble, no la distància a la paret ni a l'origen", () => {
    // Tauleta de 900 × 340 × 900 col·locada a 1200 de la paret i a x 600: abans sortia 1500 × 340 × 2100.
    expect(compositionDims(item("store-salo-taula-de-centre-1").make())).toBe("900 × 340 × 900")
    expect(item("store-salo-taula-de-centre-1").description).toContain("900 × 340 × 900 mm")
  })
})
