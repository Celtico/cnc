/**
 * Només per als tests: el context real de la màquina del taller (exportat de Maestro), a
 * `docs/maestro/AA10008021.machinecontext` (només lectura). Es llegeix amb `node:fs` amb un
 * import dinàmic perquè el `tsc` de l'app no inclou els tipus de Node.
 */
const fsMod = "node:fs"
const { readFileSync } = (await import(/* @vite-ignore */ fsMod)) as { readFileSync: (p: string) => Uint8Array }

export const CTX_DIR = "docs/maestro/AA10008021.machinecontext"
export const CTX_FILES = ["Tlgx/def.tlgx", "Atrx/def.atrx", "Cfgx/AA10008021.cfgx", "Settings/XilogHeaderParameters.xml"] as const

export const bytes = (p: string): Uint8Array => new Uint8Array(readFileSync(`${CTX_DIR}/${p}`))
export const read = (p: string): string => new TextDecoder().decode(bytes(p))
