// Simple in-memory store (resets on cold start — OK for now)
const memoryStore = new Map()

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") return res.status(200).end()
    if (req.method !== "POST")
        return res.status(405).json({ reply: "Method not allowed" })

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ reply: "Missing GROQ_API_KEY" })
    }

    let body = ""
    await new Promise((resolve) => {
        req.on("data", (chunk) => (body += chunk))
        req.on("end", resolve)
    })

    const parsed = JSON.parse(body || "{}")

    const {
        message,
        mode = "chat", // chat | rewrite
        tone = "neutral", // male | female | neutral
        indianContext = false,
        sessionId = "default",
    } = parsed

    if (!message) {
        return res.status(400).json({ reply: "Message is required" })
    }

    // 🔄 Conversation memory
    const history = memoryStore.get(sessionId) || []

    // 🧠 SYSTEM PROMPT (DYNAMIC)
    const systemPrompt = `
You are a friendly, empathetic relationship coach.

Your job is to help with dating, relationships, and emotional clarity.

Core principles:
- Be warm, calm, and non-judgmental
- Encourage confidence without manipulation
- Promote consent, respect, and emotional safety
- Normalize nervousness and dating anxiety
- Give practical advice and examples
- Avoid extreme or absolute statements

IMPORTANT FORMATTING RULES:
- If the user writes in bullet/point format, respond in bullet/point format too.
- If your answer includes steps, always use numbered points.
- Keep replies clean and skimmable, avoid long paragraphs.

Tone mode: ${tone}
${
    tone === "male"
        ? "Respond in a grounded, confident, masculine tone."
        : tone === "female"
        ? "Respond in a warm, emotionally expressive, feminine tone."
        : "Respond in a neutral, balanced tone."
}

${
    indianContext
        ? `
Cultural context:
- Dating norms in India
- Sensitivity to family, social circles, and privacy
- Avoid overly aggressive or westernized advice
`
        : ""
}

If the user seems anxious:
- Slow the response
- Reassure them
- Break advice into small steps
- Normalize fear of rejection

Rewrite mode rules:
- Improve confidence and clarity
- Keep message natural and respectful
- Do not sound cheesy or scripted
- Preserve original intent
`

    // 📝 USER PROMPT (MODE AWARE)
    const userPrompt =
        mode === "rewrite"
            ? `Rewrite the following message to sound confident, natural, and respectful:\n\n"${message}"`
            : message

    const messages = [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userPrompt },
    ]

    try {
        // ✅ Streaming response
        const groqResponse = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages,
                    stream: true, // ✅ IMPORTANT
                }),
            }
        )

        if (!groqResponse.ok) {
            const errText = await groqResponse.text()
            return res.status(500).json({
                reply: "Groq API error",
                debug: errText,
            })
        }

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        })

        const reader = groqResponse.body.getReader()
        const decoder = new TextDecoder("utf-8")

        let fullReply = ""

        while (true) {
            const { value, done } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split("\n")

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue

                const dataStr = line.replace("data: ", "").trim()
                if (dataStr === "[DONE]") continue

                try {
                    const json = JSON.parse(dataStr)
                    const token = json.choices?.[0]?.delta?.content || ""

                    if (token) {
                        fullReply += token
                        // send token to frontend
                        res.write(`data: ${JSON.stringify({ token })}\n\n`)
                    }
                } catch (e) {
                    // ignore parsing noise
                }
            }
        }

        // ✅ Save memory (last 6 messages)
        const updatedHistory = [
            ...history,
            { role: "user", content: userPrompt },
            { role: "assistant", content: fullReply },
        ].slice(-6)

        memoryStore.set(sessionId, updatedHistory)

        // End stream
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            reply: "Something went wrong. Take a breath — try again.",
        })
    }
}
