import { Splitter } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { usePersistentNumber } from "../lib/usePersistentNumber"
import { PanelSplit, SplitHandle } from "./PanelSplit"

const FORM_WIDTH = 520

/**
 * Els editors de Preferències (`FloatingWindow` amb `split`: materials, ferratges): la mostra a l'esquerra i el formulari
 * (les seccions plegables) a la dreta, amb la vora arrossegable (`PanelSplit`, el `Splitter` de Chakra). L'amplada del
 * formulari es recorda per editor (`id`); a sota de `lg`, un sota l'altre com abans.
 */
export function StageFormSplit({ id, stage, form }: { id: string; stage: ReactNode; form: ReactNode }) {
  const [formWidth, setFormWidth] = usePersistentNumber(`mobles:${id}-form-width`, FORM_WIDTH)
  return (
    <PanelSplit from="lg" flex={{ lg: 1 }} minW={0} minH={{ lg: 0 }} h={{ lg: "full" }} panels={[{ id: "stage", min: 280 }, { id: "form", width: formWidth, setWidth: setFormWidth, min: 340, max: 760 }]}>
      <Splitter.Panel id="stage" display={{ lg: "flex" }} flexDirection="column" minH={0}>
        {stage}
      </Splitter.Panel>
      <SplitHandle id="stage:form" label="Amplada del formulari" onReset={() => setFormWidth(FORM_WIDTH)} />
      <Splitter.Panel id="form" display={{ lg: "flex" }} flexDirection="column" minH={0}>
        {form}
      </Splitter.Panel>
    </PanelSplit>
  )
}
