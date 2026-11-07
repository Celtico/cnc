import { Button, HStack } from "@chakra-ui/react"
import { LuCpu } from "react-icons/lu"
import { NumRow } from "../../components/NumRow"
import { toaster } from "../../components/ui/toaster"
import { DEFAULT_WOODWOP, toWoodwop, woodwopZip } from "../../core/export/woodwop"
import type { Panel } from "../../core/model"
import { usePersistentNumber } from "../../lib/usePersistentNumber"
import { ExportCard } from "./ExportCard"

/** Programes per peça per a Homag / Weeke (WoodWOP, .mpr) i Holz-Her (NC-HOPS, .hop), amb els números d'eina. */
export function WoodwopCard({ project, base, panels, download }: { project: string; base: string; panels: Panel[]; download: (blob: Blob, name: string) => void }) {
  const [profileTool, setProfileTool] = usePersistentNumber("mobles:woodwop-profile-tool", DEFAULT_WOODWOP.profileTool)
  const [grooveTool, setGrooveTool] = usePersistentNumber("mobles:woodwop-groove-tool", DEFAULT_WOODWOP.grooveTool)
  const run = (format: "mpr" | "hop") => {
    const x = toWoodwop(panels, format, { project, options: { ...DEFAULT_WOODWOP, profileTool, grooveTool } })
    download(new Blob([woodwopZip(x) as BlobPart], { type: "application/zip" }), `${base}-${format === "mpr" ? "woodwop" : "hops"}.zip`)
    toaster.create({
      title: format === "mpr" ? "Programes WoodWOP generats" : "Programes NC-HOPS generats",
      description: `${x.programs} programes .${format}` + (x.faceB.length ? ` (${x.faceB.length} de cara B)` : "") + (x.warnings.length ? ` · ${x.warnings.length} avisos al LLEGEIX-ME` : ""),
      type: x.warnings.length ? "warning" : "success",
    })
  }
  return (
    <ExportCard
      icon={<LuCpu />}
      title="Homag i Holz-Her (WoodWOP / NC-HOPS)"
      description="Un programa per peça amb la cara A amunt (forats, forats de cantell, ranures i perfilat del contorn) i, si cal, el de la cara B («<ref>Volt»). Els buidats i els talls interiors encara no hi van (surten al LLEGEIX-ME). BETA: prova'ls a la màquina abans de mecanitzar."
      files={`${base}-woodwop.zip · ${base}-hops.zip`}
      action={
        <HStack gap={2} wrap="wrap">
          <Button variant="outline" onClick={() => run("mpr")} disabled={!panels.length}>
            <LuCpu /> WoodWOP (.mpr)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => run("hop")} disabled={!panels.length}>
            NC-HOPS (.hop)
          </Button>
        </HStack>
      }
    >
      <HStack gap={4} wrap="wrap">
        <NumRow label="Eina de perfilar" value={profileTool} onChange={setProfileTool} min={1} max={9999} suffix="" />
        <NumRow label="Eina de ranurar" value={grooveTool} onChange={setGrooveTool} min={1} max={9999} suffix="" />
      </HStack>
    </ExportCard>
  )
}
