import { shrinkImage } from "../../../lib/imageShrink"
import { blobToBase64 } from "../../file/mobleIo"

/** Tria una imatge de plànol i la redueix (2400 px de costat llarg, JPEG; `shrinkImage`, la de tota l'app). */
export function pickPlanImage(): Promise<{ src: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      shrinkImage(file, 2400, { jpeg: true, quality: 0.85 })
        .then(async ({ blob, width, height }) => resolve({ src: `data:image/jpeg;base64,${await blobToBase64(blob)}`, w: width, h: height }))
        .catch(() => resolve(null))
    }
    input.click()
  })
}
