import { Input, Switch, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuFactory } from "react-icons/lu"
import { ChoiceChips, FormRow, FormSection } from "../../../components/FormRow"
import { NumRow } from "../../../components/NumRow"
import { SettingsGroup } from "../../../components/SettingsGroup"
import { bitsLabel, DEFAULT_LOAD_MACRO_ARGS, machineNesting, nestProgram, parseMacroArgs, toolLabel, type Machine } from "../../../core/model"
import { usableTool } from "../../../core/machine/tools"

/** «Programes per tauler (nesting)»: la fresa del contorn, el marge, la separació i la capçalera dels programes. */
export function NestingGroup({ m, update }: { m: Machine; update: (patch: Partial<Machine>) => void }) {
  return (
    <SettingsGroup
      icon={<LuFactory />}
      title="Programes per tauler (nesting)"
      summary={`marge ${machineNesting(m).edgeTrimMode === "tool" ? `Ø + ${comma(machineNesting(m).edgeTrimExtra ?? 0)}` : `${comma(machineNesting(m).edgeTrim)} mm`} · separació Ø + ${String(machineNesting(m).spacingExtra).replace(".", ",")} · martiri ${String(machineNesting(m).overcut).replace(".", ",")} mm`}
    >
      <FormRow label="Fresa del contorn" help="Contorns de les peces per fora quan cap regla de «Perfilar» no val per al gruix. Automàtica: la que diu «nesting» al nom o, si no, la més petita que travessa el tauler.">
        <ChoiceChips<string>
          label="Fresa del contorn"
          options={[
            { id: "", label: "Automàtica" },
            ...m.tools.filter((t) => t.kind === "router" && usableTool(t)).map((t) => ({ id: t.code, label: toolLabel(t) })),
          ]}
          value={machineNesting(m).tool ?? ""}
          onChange={(tool) => update({ nesting: { ...machineNesting(m), tool: tool || undefined } })}
        />
      </FormRow>
      <FormRow
        label="Marge del tauler"
        help="Vora del tauler que no s'aprofita. «Fix»: sempre la mateixa (10 mm fins ara; la fresa passa una mica per l'aire). «Ø de la fresa»: el Ø de la fresa del contorn (la que fixa la separació, la més grossa del moble) més el que s'hi posi, com el programa real del taller (12 = Ø12): la passada del contorn neteja la vora del tauler. Pendent de confirmar amb el taller."
      >
        <ChoiceChips<"fixed" | "tool">
          label="Marge del tauler"
          options={[
            { id: "fixed", label: "Fix" },
            { id: "tool", label: "Ø de la fresa +" },
          ]}
          value={machineNesting(m).edgeTrimMode ?? "fixed"}
          onChange={(edgeTrimMode) => update({ nesting: { ...machineNesting(m), edgeTrimMode } })}
        />
      </FormRow>
      {machineNesting(m).edgeTrimMode === "tool" ? (
        <NumRow label="Marge (Ø +)" help="Mm de més sobre el Ø de la fresa del contorn (0 = just el Ø)." value={machineNesting(m).edgeTrimExtra ?? 0} min={0} max={50} step={0.5} onChange={(edgeTrimExtra) => update({ nesting: { ...machineNesting(m), edgeTrimExtra } })} />
      ) : (
        <NumRow label="Marge" help="Mm de vora a cada costat del tauler." value={machineNesting(m).edgeTrim} min={0} max={100} step={1} onChange={(edgeTrim) => update({ nesting: { ...machineNesting(m), edgeTrim } })} />
      )}
      <NumRow label="Separació (Ø +)" help="Entre peces: el Ø de la fresa del contorn més aquest tant." value={machineNesting(m).spacingExtra} min={0} max={20} step={0.5} onChange={(spacingExtra) => update({ nesting: { ...machineNesting(m), spacingExtra } })} />
      <NumRow label="Martiri" help="Els contorns i talls passants baixen aquest tant per sota del tauler." value={machineNesting(m).overcut} min={0} max={3} step={0.1} onChange={(overcut) => update({ nesting: { ...machineNesting(m), overcut } })} />
      <FormRow label="Peces petites" help="Ordre dels contorns: les peces petites (menys aguantades pel buit) al final o al principi.">
        <ChoiceChips<"last" | "first">
          label="Peces petites"
          options={[
            { id: "last", label: "Al final" },
            { id: "first", label: "Al principi" },
          ]}
          value={machineNesting(m).smallParts}
          onChange={(smallParts) => update({ nesting: { ...machineNesting(m), smallParts } })}
        />
      </FormRow>
      <FormSection title="Capçalera dels programes per tauler">
        <Text fontSize="sm" color="fg.muted">
          Per defecte, la del programa de nesting real del taller (TopSolid → Maestro). L'àrea, la taula, les repeticions, el cicle continu i
          «conservar la seqüència» són els de «Programes .xcs».
        </Text>
        <FormRow
          label="Opcions mecàniques"
          help={
            <>
              <Text as="span" fontFamily="mono">{bitsLabel(nestProgram(m).mechanicalOptions)}</Text>. MechanicalOptions dels programes per tauler: cada bit és una casella del diàleg
              d'opcions mecàniques del Maestro. El programa real del taller diu 16777216 (només el bit 24; el .pgmx d'una peça, 16973824 = bits 16, 17 i 24).
              Què vol dir cada bit: pendent de confirmar amb el taller.
            </>
          }
        >
          <Input
            size="sm"
            maxW="160px"
            inputMode="numeric"
            value={String(nestProgram(m).mechanicalOptions)}
            onChange={(e) => update({ nesting: { ...machineNesting(m), program: { ...nestProgram(m), mechanicalOptions: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 } } })}
          />
        </FormRow>
        <NumRow
          label="Posició a la taula X"
          help="SetWorkpieceSetupPosition: on va la cantonada del tauler a la taula. El real: (0, −20)."
          value={nestProgram(m).setupPosition.x}
          min={-5000}
          max={5000}
          step={1}
          onChange={(x) => update({ nesting: { ...machineNesting(m), program: { ...nestProgram(m), setupPosition: { ...nestProgram(m).setupPosition, x } } } })}
        />
        <NumRow
          label="Posició a la taula Y"
          value={nestProgram(m).setupPosition.y}
          min={-5000}
          max={5000}
          step={1}
          onChange={(y) => update({ nesting: { ...machineNesting(m), program: { ...nestProgram(m), setupPosition: { ...nestProgram(m).setupPosition, y } } } })}
        />
        <NumRow
          label="Posició a la taula Z"
          help="Alçada de la cara de sota del tauler. El real: 0."
          value={nestProgram(m).setupPosition.z}
          min={-500}
          max={500}
          step={1}
          onChange={(z) => update({ nesting: { ...machineNesting(m), program: { ...nestProgram(m), setupPosition: { ...nestProgram(m).setupPosition, z } } } })}
        />
        <NumRow
          label="Gir a la taula"
          suffix="°"
          help="Gir del tauler a la taula (4t paràmetre). El real: 0. Què és el −20 de la Y (topalls, càrrega?): pendent de confirmar amb el taller."
          value={nestProgram(m).setupPosition.rot}
          min={-360}
          max={360}
          step={90}
          onChange={(rot) => update({ nesting: { ...machineNesting(m), program: { ...nestProgram(m), setupPosition: { ...nestProgram(m).setupPosition, rot } } } })}
        />
        <NumRow
          label="Campana"
          suffix=""
          help="SetPneumaticHoodPosition: 0 = alta, 1–8 = baixa a la posició n. El real: 1."
          value={nestProgram(m).pneumaticHood}
          min={0}
          max={8}
          step={1}
          onChange={(h) => update({ nesting: { ...machineNesting(m), program: { ...nestProgram(m), pneumaticHood: Math.max(0, Math.min(8, Math.round(h))) } } })}
        />
        <FormRow label="Macro de càrrega" help="CreateMacro(«Pload», «PLOAD», …) tal com surt al programa real del taller.">
          <Switch.Root size="sm" pt={1.5} checked={nestProgram(m).loadMacro} onCheckedChange={(e) => update({ nesting: { ...machineNesting(m), program: { ...nestProgram(m), loadMacro: e.checked } } })}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Pload</Switch.Label>
          </Switch.Root>
        </FormRow>
        {nestProgram(m).loadMacro && (
          <MacroArgsRow
            value={nestProgram(m).loadMacroArgs ?? DEFAULT_LOAD_MACRO_ARGS}
            onChange={(loadMacroArgs) => update({ nesting: { ...machineNesting(m), program: { ...nestProgram(m), loadMacroArgs } } })}
          />
        )}
        <FormRow label="Evitar que caiguin peces" help="SetWorkPieceFallPrevention (el porta el programa real; no és al manual).">
          <Switch.Root size="sm" pt={1.5} checked={nestProgram(m).fallPrevention} onCheckedChange={(e) => update({ nesting: { ...machineNesting(m), program: { ...nestProgram(m), fallPrevention: e.checked } } })}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">WorkPieceFallPrevention</Switch.Label>
          </Switch.Root>
        </FormRow>
      </FormSection>
    </SettingsGroup>
  )
}

/** Número amb coma decimal. */
const comma = (n: number) => String(n).replace(".", ",")

/**
 * Paràmetres de la macro de càrrega (`CreateMacro("Pload", "PLOAD", …)`), escrits a mà: es desen en acabar (sortir del camp
 * o Retorn) si són vàlids (números o true/false separats per comes); si no, l'error en vermell i, en sortir, es queda
 * l'anterior (Esc el desfà), com el nom dels materials.
 */
function MacroArgsRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? value
  const parsed = parseMacroArgs(text)
  const commit = () => {
    if (draft !== null && parsed) {
      const v = parsed.join(", ")
      if (v !== value) onChange(v)
    }
    setDraft(null)
  }
  return (
    <FormRow
      label="Paràmetres de Pload"
      help={
        <>
          {!parsed && (
            <Text as="span" display="block" color="fg.error">
              Han de ser números o true/false separats per comes.
            </Text>
          )}
          Els de després de «"Pload", "PLOAD"», tal com surten al programa. El real: {DEFAULT_LOAD_MACRO_ARGS}. Què vol dir cada un: pendent de
          confirmar amb el taller.
        </>
      }
    >
      <Input
        size="sm"
        fontFamily="mono"
        aria-label="Paràmetres de la macro Pload"
        aria-invalid={!parsed || undefined}
        value={text}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") setDraft(null)
        }}
      />
    </FormRow>
  )
}
