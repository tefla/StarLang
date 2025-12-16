// Forge Error Formatting
// Rich error messages with source context and visual pointers

export interface ForgeErrorLocation {
  line: number
  column: number
  endLine?: number
  endColumn?: number
}

export interface ForgeErrorOptions {
  message: string
  location: ForgeErrorLocation
  source?: string
  filePath?: string
  hint?: string
}

/**
 * Format a Forge error with source context.
 * Shows the problematic line with a visual pointer.
 */
export function formatForgeError(options: ForgeErrorOptions): string {
  const { message, location, source, filePath, hint } = options
  const lines: string[] = []

  // Error header
  const fileInfo = filePath ? `${filePath}:` : ''
  lines.push(`error: ${message}`)
  lines.push(`  --> ${fileInfo}${location.line}:${location.column}`)

  // Source context
  if (source) {
    const sourceLines = source.split('\n')
    const lineNum = location.line
    const lineIndex = lineNum - 1

    // Show 1 line of context before (if available)
    if (lineIndex > 0) {
      lines.push(formatSourceLine(lineNum - 1, sourceLines[lineIndex - 1] ?? ''))
    }

    // Show the error line
    if (lineIndex >= 0 && lineIndex < sourceLines.length) {
      lines.push(formatSourceLine(lineNum, sourceLines[lineIndex] ?? '', true))

      // Show pointer
      const pointerLine = createPointer(location.column, location.endColumn)
      lines.push(formatSourceLine(null, pointerLine))
    }

    // Show 1 line of context after (if available)
    if (lineIndex + 1 < sourceLines.length) {
      lines.push(formatSourceLine(lineNum + 1, sourceLines[lineIndex + 1] ?? ''))
    }
  }

  // Hint
  if (hint) {
    lines.push('')
    lines.push(`hint: ${hint}`)
  }

  return lines.join('\n')
}

/**
 * Format a source line with line number gutter.
 */
function formatSourceLine(lineNum: number | null, content: string, highlight = false): string {
  const gutter = lineNum !== null
    ? `${String(lineNum).padStart(4)} | `
    : '     | '

  const prefix = highlight ? '>' : ' '
  return `${prefix}${gutter}${content}`
}

/**
 * Create a visual pointer line (^^^) under the error location.
 */
function createPointer(column: number, endColumn?: number): string {
  const start = Math.max(0, column - 1)
  const length = endColumn ? Math.max(1, endColumn - column) : 1
  return ' '.repeat(start) + '^'.repeat(length)
}

/**
 * ForgeError - Base error class with rich formatting.
 */
export class ForgeError extends Error {
  public location: ForgeErrorLocation
  public source?: string
  public filePath?: string
  public hint?: string

  constructor(options: ForgeErrorOptions) {
    super(options.message)
    this.name = 'ForgeError'
    this.location = options.location
    this.source = options.source
    this.filePath = options.filePath
    this.hint = options.hint
  }

  /**
   * Get formatted error message with source context.
   */
  format(): string {
    return formatForgeError({
      message: this.message,
      location: this.location,
      source: this.source,
      filePath: this.filePath,
      hint: this.hint
    })
  }

  /**
   * Override toString to show formatted error.
   */
  toString(): string {
    return this.format()
  }
}

/**
 * Attach source context to an existing error.
 */
export function attachSourceContext(
  error: { message: string; line?: number; column?: number; loc?: ForgeErrorLocation },
  source: string,
  filePath?: string
): ForgeError {
  const location = error.loc ?? {
    line: error.line ?? 1,
    column: error.column ?? 1
  }

  return new ForgeError({
    message: error.message,
    location,
    source,
    filePath
  })
}

/**
 * Format multiple errors for display.
 */
export function formatErrors(
  errors: Array<{ message: string; line?: number; column?: number; loc?: ForgeErrorLocation }>,
  source: string,
  filePath?: string
): string {
  return errors
    .map(e => attachSourceContext(e, source, filePath).format())
    .join('\n\n')
}
