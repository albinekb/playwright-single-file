export function removeScripts(content: string) {
  return content.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>\s*/gi,
    '',
  )
}

export function removeEmptyLines(content: string) {
  return content.replace(/\n\s*\n\s*\n+/g, '\n\n')
}
