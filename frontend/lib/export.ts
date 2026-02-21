function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'export'
}

export function toCSV(headers: string[], rows: unknown[][]): string {
  if (headers.length === 0) return ''
  const lines = [headers.map(escapeCSVField).join(',')]
  for (const row of rows) {
    lines.push(row.map(cell => escapeCSVField(String(cell))).join(','))
  }
  return lines.join('\n')
}

export function toJSON(headers: string[], rows: unknown[][]): string {
  if (headers.length === 0) return '[]'
  const objects = rows.map(row =>
    Object.fromEntries(headers.map((h, i) => [h, String(row[i])]))
  )
  return JSON.stringify(objects, null, 2)
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportAsCSV(headers: string[], rows: unknown[][], title: string) {
  const csv = toCSV(headers, rows)
  triggerDownload(csv, `${sanitizeFilename(title)}.csv`, 'text/csv')
}

export function exportAsJSON(headers: string[], rows: unknown[][], title: string) {
  const json = toJSON(headers, rows)
  triggerDownload(json, `${sanitizeFilename(title)}.json`, 'application/json')
}
