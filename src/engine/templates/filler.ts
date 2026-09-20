// Fills `{variable}` placeholders in a template line from a data record.
// Throws in dev if a placeholder has no matching value, so missing content
// data is caught immediately instead of leaking "{opponent}" into the feed.

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!(key in vars)) {
      if (import.meta.env.DEV) {
        console.warn(`fillTemplate: missing variable "${key}" for template "${template}"`)
      }
      return match
    }
    return String(vars[key])
  })
}
