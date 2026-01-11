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
                }),
            }
        )

        const data = await groqResponse.json()
        const reply = data.choices[0].message.content

        // Save memory (last 6 messages only)
        const updatedHistory = [
            ...history,
            { role: "user", content: userPrompt },
            { role: "assistant", content: reply },
        ].slice(-6)

        memoryStore.set(sessionId, updatedHistory)

        return res.status(200).json({ reply })
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            reply: "Something went wrong. Take a breath — try again.",
        })
    }
}
