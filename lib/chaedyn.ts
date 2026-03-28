/**
 * Chaedyn — AJM Fit AI Assistant
 * Simple keyword-based retrieval from ISSA knowledge base chunks.
 */
import knowledgeBase from './knowledge-base.json'

type Chunk = {
  content: string
  source: string
  index: number
}

const chunks = knowledgeBase as Chunk[]

/**
 * Find the most relevant chunks for a query using keyword matching.
 * Returns top N chunks sorted by relevance score.
 */
export function searchKnowledgeBase(query: string, topK = 5): Chunk[] {
  const queryWords = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)

  if (queryWords.length === 0) return []

  const scored = chunks.map(chunk => {
    const content = chunk.content.toLowerCase()
    let score = 0

    for (const word of queryWords) {
      // Count occurrences of each query word in the chunk
      const regex = new RegExp(word, 'gi')
      const matches = content.match(regex)
      if (matches) {
        score += matches.length
      }
    }

    // Bonus for chunks that contain multiple query words
    const uniqueMatches = queryWords.filter(w => content.includes(w)).length
    score += uniqueMatches * 2

    return { chunk, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.chunk)
}

/**
 * Build context string from relevant chunks for the LLM prompt.
 */
export function buildContext(query: string): string {
  const relevant = searchKnowledgeBase(query, 6)

  if (relevant.length === 0) {
    return 'No specific documentation found for this query.'
  }

  return relevant
    .map((chunk, i) => `[Source: ${chunk.source}]\n${chunk.content}`)
    .join('\n\n---\n\n')
}

export const CHAEDYN_SYSTEM_PROMPT = `You are Chaedyn, the AJM Fit AI fitness assistant powered by ISSA-certified knowledge.

CRITICAL: Keep responses SHORT — 2-4 sentences max. Use bullet points only when listing 3+ items. No long paragraphs.

Personality: Knowledgeable, approachable, motivating. Evidence-based but conversational.

Rules:
- Answer using the provided ISSA context
- If unsure, say "Ask Coach Anthony for personalized advice"
- Never provide medical diagnosis
- Be concise — clients want quick, actionable answers`
