import type { Key } from '@nut-tree-fork/nut-js'
import { normalizeKeyNames } from '@shared/hotkey'

type NutKeyEnum = (typeof import('@nut-tree-fork/nut-js'))['Key']
type NutKeyName = keyof NutKeyEnum & string

/**
 * 修飾キーの変換先。
 * libnut は macOS で "cmd" / Windows で "win" しか解釈できないが、
 * "meta" はどちらでも同じキー（Command / Windows キー）に当たるため LeftMeta に揃える
 */
const MODIFIER_KEY_MEMBERS: Record<string, NutKeyName> = {
  Ctrl: 'LeftControl',
  Control: 'LeftControl',
  Shift: 'LeftShift',
  Alt: 'LeftAlt',
  Opt: 'LeftAlt',
  Option: 'LeftAlt',
  Cmd: 'LeftMeta',
  Command: 'LeftMeta',
  Super: 'LeftMeta',
  Meta: 'LeftMeta',
  Win: 'LeftMeta'
}

const KEY_MEMBERS: Record<string, NutKeyName> = {
  Enter: 'Return',
  Return: 'Return',
  NumpadEnter: 'Enter',
  Esc: 'Escape',
  Escape: 'Escape',
  Tab: 'Tab',
  Space: 'Space',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Up: 'Up',
  Down: 'Down',
  Left: 'Left',
  Right: 'Right',
  CapsLock: 'CapsLock',
  PrintScreen: 'Print',
  ScrollLock: 'ScrollLock',
  Pause: 'Pause',
  NumpadAdd: 'Add',
  NumpadSubtract: 'Subtract',
  NumpadMultiply: 'Multiply',
  NumpadDivide: 'Divide',
  NumpadDecimal: 'Decimal',
  '-': 'Minus',
  '=': 'Equal',
  '[': 'LeftBracket',
  ']': 'RightBracket',
  '\\': 'Backslash',
  ';': 'Semicolon',
  "'": 'Quote',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  '`': 'Grave'
}

function defaultMemberName(name: string): string | null {
  if (/^[A-Z]$/.test(name)) return name
  if (/^[0-9]$/.test(name)) return `Num${name}`
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(name)) return name
  if (/^Numpad[0-9]$/.test(name)) return `NumPad${name.slice(6)}`
  return null
}

function resolveKey(name: string, keyEnum: NutKeyEnum): Key {
  const member = MODIFIER_KEY_MEMBERS[name] ?? KEY_MEMBERS[name] ?? defaultMemberName(name)
  const table = keyEnum as unknown as Record<string, Key | undefined>
  const key = member === null ? undefined : table[member]
  if (key === undefined) throw new Error(`「${name}」というキーには対応していません`)
  return key
}

/** 保存済みのキー名を修飾キー順に並べ替え、nut.js のキーへ変換する */
export function toNutKeys(names: string[], keyEnum: NutKeyEnum): Key[] {
  return normalizeKeyNames(names).map((name) => resolveKey(name, keyEnum))
}
