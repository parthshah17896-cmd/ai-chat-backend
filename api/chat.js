// ✅ In-memory store (resets on cold start — OK for now)
const memoryStore = new Map()

/* ---------------- SAFETY FILTERS ---------------- */

function containsUnsafeContent(text = "") {
    const t = text.toLowerCase()

    const sexualExplicit = [
        "nude",
        "nudes",
        "sex",
        "porn",
        "onlyfans",
        "blowjob",
        "handjob",
        "oral",
        "suck",
        "dick",
        "penis",
        "pussy",
        "vagina",
        "boobs",
        "tits",
        "cum",
        "orgasm",
        "horny",
        "escort",
        "prostitute",
    ]

    const sexualOffence = [
        "rape",
        "molest",
        "sexual assault",
        "force her",
        "force him",
        "coerce",
        "blackmail",
        "threaten",
        "stalk",
        "revenge porn",
        "leaked",
        "leak her",
        "leak his",
    ]

    const abusive = [
        "bitch",
        "slut",
        "whore",
        "madarchod",
        "bhosdike",
        "chutiya",
        "gaand",
        "harami",
        "randi",
    ]

    const privacy = [
        "otp",
        "password",
        "passcode",
        "bank account",
        "account number",
        "credit card",
        "cvv",
        "pin",
        "address",
        "phone number",
        "mobile number",
        "aadhar",
        "aadhaar",
        "pan number",
        "upi pin",
    ]

    return (
        sexualExplicit.some((w) => t.includes(w)) ||
        sexualOffence.some((w) => t.includes(w)) ||
        abusive.some((w) => t.includes(w)) ||
        privacy.some((w) => t.includes(w))
    )
}

function safeRefusalMessage() {
    return `I can’t help with sexual content, nudity, harassment, abusive language, or anything that violates privacy.

But I *can* help you with:
- writing a respectful message
- handling rejection calmly
- setting boundaries
- improving your conversation in a healthy way 🤍`
}

/* ---------------- API HANDLER ---------------- */

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
        mode = "chat",
        tone = "neutral",
        indianContext = true,
        sessionId = "default",
    } = parsed

    if (!message) {
        return res.status(400).json({ reply: "Message is required" })
    }

    // ✅ Hard safety block
    if (containsUnsafeContent(message)) {
        return res.status(200).json({ reply: safeRefusalMessage() })
    }

    // 🔄 Conversation memory
    const history = memoryStore.get(sessionId) || []

    const systemPrompt = `
You are a friendly, empathetic relationship coach.

Core principles:
- Be warm, calm, and non-judgmental
- Encourage confidence without manipulation
- Promote consent, respect, and emotional safety
- Give practical advice and examples

TEXT-ONLY RESTRICTION:
- You are a text-based assistant ONLY.
- Do NOT generate sexual/nude content.
- Do NOT generate harassment or abusive content.
- Do NOT request or reveal private data (OTP, phone numbers, address, passwords).
- If user asks for disallowed content, refuse briefly and redirect to safe help.

IMPORTANT FORMATTING:
- If the user writes in points/bullets, respond in points/bullets.
- If your reply includes steps, use numbered points.
- Avoid long paragraphs.

Tone mode: ${tone}

${
    indianContext
        ? `
India context:
- Keep advice culturally sensitive and respectful
- Avoid aggressive/westernized extremes
`
        : ""
}
`

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
                    stream: true,
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
                if (!dataStr || dataStr === "[DONE]") continue

                try {
                    const json = JSON.parse(dataStr)
                    const token = json.choices?.[0]?.delta?.content || ""

                    if (token) {
                        fullReply += token
                        res.write(`data: ${JSON.stringify({ token })}\n\n`)
                    }
                } catch {
                    // ignore
                }
            }
        }

        // ✅ Save memory (last 50 messages)
        const updatedHistory = [
            ...history,
            { role: "user", content: userPrompt },
            { role: "assistant", content: fullReply },
        ].slice(-50)

        memoryStore.set(sessionId, updatedHistory)

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
        res.end()
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            reply: "Something went wrong. Take a breath — try again.",
        })
    }
}
