import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { buildContext, CHAEDYN_SYSTEM_PROMPT } from '@/lib/chaedyn'
import { clientAppMapPrompt } from '@/lib/app-map'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { messages, portal } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 })
    }

    // Get the latest user message for context retrieval
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    const context = lastUserMessage ? buildContext(lastUserMessage.content) : ''

    const systemMessage = `${CHAEDYN_SYSTEM_PROMPT}

${
  portal === 'admin'
    ? `You are also helping Coach Anthony (the admin) with client management, program design, and ISSA reference lookups. Be more technical and detailed in your responses since you're talking to the coach.`
    : clientAppMapPrompt()
}

Here is relevant ISSA documentation to help answer the question:

${context}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        ...messages.slice(-10), // Last 10 messages for context
      ],
      max_tokens: 400,
      temperature: 0.7,
      stream: true,
    })

    // Stream the response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: unknown) {
    console.error('Chat API error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
