import { Badge, Box, Editable, Flex, HStack, IconButton, Stack, Text } from "@chakra-ui/react"
import { useEffect, useMemo, useState } from "react"
import { LuCircleDot, LuExpand, LuShrink } from "react-icons/lu"
import { CabinetViewer } from "../../components/viewer/CabinetViewer"
import { CabinetParamsSchema, type CabinetParams } from "../../core/model"
import { renameProject, updateProjectParams } from "../../db/db"
import { useCabinet, useProject } from "../useProject"
import { ParamsForm, type Draft } from "./ParamsForm"

export function EditorScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  if (!project) return null
  return <Editor key={project.id} projectId={project.id} name={project.name} initial={project.params} />
}

function Editor({ projectId, name, initial }: { projectId: number; name: string; initial: CabinetParams }) {
  // `draft` és el que s'està escrivint; `valid` són els darrers paràmetres que han
  // passat la validació i que alimenten el model 3D i la base de dades.
  const [{ draft, valid }, setState] = useState<{ draft: Draft; valid: CabinetParams }>({
    draft: initial,
    valid: initial,
  })
  const [exploded, setExploded] = useState(false)
  const [showHoles, setShowHoles] = useState(true)

  const update = (patch: (d: Draft) => Draft) =>
    setState((s) => {
      const draft = patch(s.draft)
      const res = CabinetParamsSchema.safeParse(draft)
      return { draft, valid: res.success ? res.data : s.valid }
    })

  const errors = useMemo(() => {
    const res = CabinetParamsSchema.safeParse(draft)
    const errors: Record<string, string> = {}
    if (!res.success) for (const issue of res.error.issues) errors[issue.path.join(".")] = issue.message
    return errors
  }, [draft])
  const isValid = Object.keys(errors).length === 0
  const params = valid
  const panels = useCabinet(params)

  // Desa amb retard quan els paràmetres són vàlids i han canviat.
  useEffect(() => {
    if (params === initial) return
    const t = setTimeout(() => void updateProjectParams(projectId, params), 350)
    return () => clearTimeout(t)
  }, [params, projectId, initial])

  const totalHoles = panels.reduce((n, p) => n + p.holes.length, 0)
  const p = params

  return (
    <Flex direction={{ base: "column", md: "row" }} gap={{ base: 0, md: 6 }} h="full" minH={0}>
      {/* Visor: a dalt al mòbil (fix), a la dreta a l'escriptori. */}
      <Box
        order={{ base: 0, md: 1 }}
        flex={{ md: 1 }}
        position="sticky"
        top={{ base: "calc(52px + env(safe-area-inset-top, 0px))", md: 6 }}
        alignSelf="flex-start"
        zIndex={1}
        h={{ base: "42vh", md: "calc(100dvh - 3rem)" }}
        rounded={{ md: "xl" }}
        overflow="hidden"
        borderWidth={{ md: "1px" }}
        mx={{ base: -4, md: 0 }}
      >
        <CabinetViewer
          panels={panels}
          size={{ width: p.width, height: p.height, depth: p.depth }}
          exploded={exploded}
          showHoles={showHoles}
        />
        <HStack position="absolute" top={3} right={3} gap={2}>
          <IconButton
            aria-label={showHoles ? "Amagar forats" : "Mostrar forats"}
            size="sm"
            variant={showHoles ? "solid" : "surface"}
            colorPalette="wood"
            onClick={() => setShowHoles((v) => !v)}
          >
            <LuCircleDot />
          </IconButton>
          <IconButton
            aria-label={exploded ? "Vista muntada" : "Vista explosionada"}
            size="sm"
            variant={exploded ? "solid" : "surface"}
            colorPalette="wood"
            onClick={() => setExploded((v) => !v)}
          >
            {exploded ? <LuShrink /> : <LuExpand />}
          </IconButton>
        </HStack>
        <HStack position="absolute" bottom={3} left={3} gap={2}>
          <Badge variant="surface">{panels.length} peces</Badge>
          <Badge variant="surface">{totalHoles} forats</Badge>
        </HStack>
      </Box>

      <Stack order={{ base: 1, md: 0 }} w={{ md: "360px", lg: "400px" }} flexShrink={0} gap={5} pt={{ base: 4, md: 0 }}>
        <Editable.Root
          defaultValue={name}
          onValueCommit={(e) => void renameProject(projectId, e.value)}
          fontSize="xl"
          fontWeight="semibold"
        >
          <Editable.Preview />
          <Editable.Input />
        </Editable.Root>
        {!isValid && (
          <Text fontSize="sm" color="fg.error">
            Hi ha valors fora de rang: el model mostra els darrers paràmetres vàlids.
          </Text>
        )}
        <ParamsForm draft={draft} errors={errors} onChange={update} />
      </Stack>
    </Flex>
  )
}
