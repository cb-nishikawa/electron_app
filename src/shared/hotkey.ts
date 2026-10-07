/** 修飾キーの表示名。表示・保存はこの順に並べる */
export const MODIFIER_KEY_NAMES = ['Ctrl', 'Shift', 'Alt', 'Cmd'] as const

export function isModifierKeyName(name: string): boolean {
  return (MODIFIER_KEY_NAMES as readonly string[]).includes(name)
}

/** KeyboardEvent.code から保存用のキー名へ変換する */
const CODE_TO_KEY_NAME: Record<string, string> = {
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  MetaLeft: 'Cmd',
  MetaRight: 'Cmd',
  Space: 'Space',
  Enter: 'Enter',
  NumpadEnter: 'NumpadEnter',
  Escape: 'Escape',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  CapsLock: 'CapsLock',
  PrintScreen: 'PrintScreen',
  ScrollLock: 'ScrollLock',
  Pause: 'Pause',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  NumpadAdd: 'NumpadAdd',
  NumpadSubtract: 'NumpadSubtract',
  NumpadMultiply: 'NumpadMultiply',
  NumpadDivide: 'NumpadDivide',
  NumpadDecimal: 'NumpadDecimal'
}

export function keyNameFromCode(code: string): string | null {
  const fixed = CODE_TO_KEY_NAME[code]
  if (fixed !== undefined) return fixed
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^Numpad[0-9]$/.test(code)) return code
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code
  return null
}

/** code が取れない場合のフォールバック */
export function keyNameFromEventKey(key: string): string | null {
  if (key.length === 0) return null
  return key.length === 1 ? key.toUpperCase() : key
}

/** 修飾キーを先頭から MODIFIER_KEY_NAMES の順に並べ、重複を除く */
export function normalizeKeyNames(names: string[]): string[] {
  const unique = [...new Set(names)]
  const modifiers = MODIFIER_KEY_NAMES.filter((name) => unique.includes(name))
  const rest = unique.filter((name) => !isModifierKeyName(name))
  return [...modifiers, ...rest]
}

export function formatHotkey(names: string[]): string {
  return normalizeKeyNames(names).join('+')
}
