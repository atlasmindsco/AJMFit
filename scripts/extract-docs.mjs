/**
 * Extract text from ISSA PDF documents and chunk into JSON for Chaedyn knowledge base.
 * Run: node scripts/extract-docs.mjs
 */
import fs from 'fs'
import path from 'path'

// Use pdfjs-dist for PDF text extraction
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

const DOCS_DIR = path.join(process.cwd(), 'docs')
const OUTPUT_FILE = path.join(process.cwd(), 'lib', 'knowledge-base.json')
const CHUNK_SIZE = 1500
const CHUNK_OVERLAP = 200

async function extractPDF(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise
  let fullText = ''

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join(' ')
    fullText += pageText + '\n\n'

    if (i % 50 === 0) {
      console.log(`    Page ${i}/${doc.numPages}`)
    }
  }

  return fullText
}

function chunkText(text, source) {
  const chunks = []
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim()

  let start = 0
  while (start < cleaned.length) {
    const end = Math.min(start + CHUNK_SIZE, cleaned.length)
    const chunk = cleaned.slice(start, end).trim()
    if (chunk.length > 50) {
      chunks.push({
        content: chunk,
        source,
        index: chunks.length,
      })
    }
    start += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks
}

async function main() {
  const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.pdf'))
  console.log(`Found ${files.length} PDFs to process`)

  const allChunks = []

  for (const file of files) {
    const filePath = path.join(DOCS_DIR, file)
    const stat = fs.statSync(filePath)
    console.log(`Processing: ${file} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`)

    try {
      const text = await extractPDF(filePath)
      console.log(`  Extracted ${text.length} characters`)

      const sourceName = file.replace('.pdf', '').replace(/%20/g, ' ')
      const chunks = chunkText(text, sourceName)
      console.log(`  Created ${chunks.length} chunks`)

      allChunks.push(...chunks)
    } catch (err) {
      console.error(`  Error processing ${file}:`, err.message)
    }
  }

  const libDir = path.dirname(OUTPUT_FILE)
  if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true })

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allChunks))
  console.log(`\nTotal: ${allChunks.length} chunks saved to ${OUTPUT_FILE}`)
  console.log(`File size: ${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(1)} MB`)
}

main().catch(console.error)
