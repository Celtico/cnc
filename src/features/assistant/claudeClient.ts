import type Anthropic from "@anthropic-ai/sdk"

/**
 * Client de l'API de Claude per a l'assistent (docs/xat-ia.md). El SDK es carrega **a demanda** (`import()`): no és al
 * bloc d'entrada; només en obrir el xat o en provar la clau. Al navegador cal `dangerouslyAllowBrowser` (la clau és de
 * l'usuari i només es desa al seu dispositiu); el SDK hi afegeix la capçalera `anthropic-dangerous-direct-browser-access`.
 * `logLevel: "off"`: res (ni la clau ni la conversa) a la consola.
 */
export async function loadSdk(): Promise<typeof import("@anthropic-ai/sdk")> {
  return import("@anthropic-ai/sdk")
}

export async function makeClient(apiKey: string): Promise<Anthropic> {
  const { default: AnthropicClient } = await loadSdk()
  return new AnthropicClient({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, logLevel: "off", maxRetries: 2 })
}

/**
 * «Provar la clau»: demana la fitxa del model triat (gratuït, sense tokens). Llança l'error del SDK si la clau no és
 * vàlida o no té accés al model.
 */
export async function testKey(apiKey: string, model: string): Promise<string> {
  const client = await makeClient(apiKey)
  const info = await client.models.retrieve(model)
  return info.display_name || info.id
}
