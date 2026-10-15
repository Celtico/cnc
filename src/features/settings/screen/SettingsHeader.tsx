import { Alert, Button, Stack } from "@chakra-ui/react"
import type { RefObject } from "react"
import { LuDownload, LuUpload } from "react-icons/lu"
import { PageHeader } from "../../../components/PageHeader"
import { fileAccept } from "../../file/fileAccept"

/** Capçalera de Preferències: el títol, Importar / Exportar i, si no és vàlid, què falla. */
export function SettingsHeader({ fileInput, onImport, onExport, problems }: { fileInput: RefObject<HTMLInputElement | null>; onImport: (file: File | undefined) => Promise<void>; onExport: () => void; problems: string[] }) {
  return (
    <Stack gap={4}>
      <input ref={fileInput} type="file" accept={fileAccept("application/json,.json")} hidden onChange={(e) => void onImport(e.target.files?.[0])} />
      <PageHeader
        title="Preferències"
        description="Mides i valors que depenen de tu i del taller. Canviar-los no modifica els mobles ja fets: només els mòduls nous i les pantalles que llegeixen aquestes llistes (foto, editor, nesting, export)."
        actions={
          <>
            {/* El primer, el principal (color principal), com «Nou moble» a les altres pàgines. */}
            <Button colorPalette="wood" size={{ base: "sm", md: "md" }} onClick={() => fileInput.current?.click()}>
              <LuUpload /> Importar
            </Button>
            <Button variant="outline" size={{ base: "sm", md: "md" }} onClick={onExport}>
              <LuDownload /> Exportar
            </Button>
          </>
        }
      />
      {problems.length > 0 && (
        <Alert.Root status="error" size="sm">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>No es desa fins que sigui vàlid</Alert.Title>
            <Alert.Description>{problems.slice(0, 3).join(" · ")}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
    </Stack>
  )
}
