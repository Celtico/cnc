import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuCheck, LuKeyRound, LuMessageSquare, LuPlugZap, LuTrash2, LuTriangleAlert } from "react-icons/lu"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { SettingsGroup } from "../../components/SettingsGroup"
import { ASSISTANT_MODELS, type AssistantPref } from "../../core/model"
import { assistantError, maskKey } from "../assistant/errors"
import { testKey } from "../assistant/claudeClient"

/**
 * Preferències › Assistent IA (docs/xat-ia.md): la clau de l'API de Claude (només se'n veuen els 4 últims caràcters; no
 * s'exporta) i el model. El navegador crida l'API directament amb aquesta clau.
 */
export function AssistantPane({ value, onChange }: { value: AssistantPref; onChange: (v: AssistantPref) => void }) {
  const [editing, setEditing] = useState(!value.apiKey)
  const [typed, setTyped] = useState("")
  const [test, setTest] = useState<{ state: "idle" | "testing" } | { state: "ok"; text: string } | { state: "error"; title: string; text: string }>({ state: "idle" })
  const model = ASSISTANT_MODELS.find((m) => m.id === value.model) ?? ASSISTANT_MODELS[0]
  const saveKey = () => {
    const k = typed.trim()
    if (!k) return
    onChange({ ...value, apiKey: k })
    setTyped("")
    setEditing(false)
    setTest({ state: "idle" })
  }
  const removeKey = () => {
    const { apiKey: _k, ...rest } = value
    void _k
    onChange(rest)
    setEditing(true)
    setTest({ state: "idle" })
  }
  const runTest = async () => {
    if (!value.apiKey) return
    setTest({ state: "testing" })
    try {
      const name = await testKey(value.apiKey, value.model)
      setTest({ state: "ok", text: `Funciona: la clau té accés a ${name}.` })
    } catch (e) {
      const err = assistantError(e, typeof navigator === "undefined" ? true : navigator.onLine)
      setTest({ state: "error", title: err.title, text: err.description })
    }
  }
  return (
    <Stack className="settings-stack" gap={6}>
      <SettingsGroup icon={<LuKeyRound />} title="Clau de l'API" summary={value.apiKey ? `Desada en aquest dispositiu (${maskKey(value.apiKey)})` : "Sense clau"}>
        <Text fontSize="sm" color="fg.muted">
          L'assistent del xat de l'Editor fa servir l'API de Claude amb la teva clau. Se'n fa una a la Claude Console
          (console.anthropic.com › API keys). Es desa només en aquest dispositiu: no surt a «Exportar» ni als fitxers .moble.
        </Text>
        {editing || !value.apiKey ? (
          <FormRow label="Clau" help="Enganxa-la i desa. Després només se'n veuran els 4 últims caràcters.">
            <HStack gap={2} maxW="460px">
              <Input
                size="sm"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-ant-…"
                aria-label="Clau de l'API"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveKey()}
              />
              <Button size="sm" colorPalette="wood" disabled={!typed.trim()} onClick={saveKey}>
                Desar
              </Button>
              {value.apiKey && (
                <Button size="sm" variant="ghost" onClick={() => (setEditing(false), setTyped(""))}>
                  Cancel·lar
                </Button>
              )}
            </HStack>
          </FormRow>
        ) : (
          <FormRow label="Clau">
            <HStack gap={2} wrap="wrap">
              <Text fontSize="sm" fontFamily="mono" pt="6px" data-testid="assistant-key-mask">
                {maskKey(value.apiKey)}
              </Text>
              <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
                Canviar
              </Button>
              <Button size="xs" variant="ghost" colorPalette="red" onClick={removeKey}>
                <LuTrash2 /> Treure
              </Button>
            </HStack>
          </FormRow>
        )}
        <FormRow label="Provar" help="Comprova la clau i que té accés al model triat (no gasta tokens).">
          <Stack gap={2} align="flex-start">
            <Button size="sm" variant="outline" disabled={!value.apiKey} loading={test.state === "testing"} onClick={() => void runTest()}>
              <LuPlugZap /> Provar la clau
            </Button>
            {test.state === "ok" && (
              <HStack gap={1.5} color="green.fg" fontSize="sm">
                <LuCheck /> <Text>{test.text}</Text>
              </HStack>
            )}
            {test.state === "error" && (
              <HStack gap={1.5} color="red.fg" fontSize="sm" align="flex-start">
                <LuTriangleAlert style={{ marginTop: 3, flexShrink: 0 }} />
                <Text>
                  <b>{test.title}.</b> {test.text}
                </Text>
              </HStack>
            )}
          </Stack>
        </FormRow>
      </SettingsGroup>
      <SettingsGroup icon={<LuMessageSquare />} title="Model" summary={`${model.label} · ${model.price} per milió de tokens`}>
        <FormRow
          label="Model"
          help={`${ASSISTANT_MODELS.map((m) => `${m.label}: ${m.hint} (${m.price} per milió de tokens d'entrada / sortida)`).join(". ")}.`}
        >
          <ChoiceChips label="Model" options={ASSISTANT_MODELS.map((m) => ({ id: m.id, label: m.label }))} value={model.id} onChange={(id) => onChange({ ...value, model: id })} />
        </FormRow>
        <Text fontSize="sm" color="fg.muted">
          Què costa: cada missatge es paga per tokens amb la teva clau; la conversa sencera (i les fotos) es torna a enviar a
          cada missatge, així que una conversa llarga costa més. Una foto (reduïda a 1568 px) són uns 2.000–2.500 tokens d'entrada. Cal connexió: el text, les
          fotos que adjuntis i un resum del moble obert van a l'API de Claude. L'app no envia res més ni en guarda cap
          registre.
        </Text>
      </SettingsGroup>
    </Stack>
  )
}
