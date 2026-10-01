import type { RenderJob } from "./engine"

/**
 * Llum típica de l'escena (`sceneKey` del `pathWorker`, en un worker a part) i distància
 * d'enfocament (la del centre de la imatge, saltant els retalls per l'alfa): la GPU les fa
 * servir igual que la CPU (que les calcula a cada worker).
 */
export function estimateSceneKey(job: RenderJob): Promise<{ key: number; focus: number }> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./pathWorker.ts", import.meta.url), { type: "module" })
    w.onmessage = (e: MessageEvent<{ type: string; key: number; focus: number }>) => {
      if (e.data.type !== "estimate") return
      w.terminate()
      resolve({ key: e.data.key, focus: e.data.focus })
    }
    w.onerror = (ev) => {
      w.terminate()
      reject(new Error(ev.message || "Error en preparar el render"))
    }
    w.postMessage({ type: "estimate", scene: job.scene, width: job.w, height: job.h, seed: 1, opts: job.opts, env: job.env })
  })
}
