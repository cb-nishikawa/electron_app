/** ipcRenderer.invoke の例外から main 側のメッセージだけを取り出す */
export function toMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
