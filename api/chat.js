import OpenAI from "openai"

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(req, res) {
    // 🔐 CORS
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") {
        return res.status(200).end()
    }

    if (req.method !== "POST") {
        return res.status(405).json({ reply: "Method not allowed" })
    }

    // ✅ Parse body (KEEPING YOUR WORKING LOGIC)
    let body = ""
    await new Promise((resolve) => {
        req.on("data", (chunk) => {
            body += chunk
        })
        req.on("end", resolve)
    })

    const parsed = JSON.parse(body || "{}")
    const message = parsed.message

    if (!message) {
        return res.status(400).json({
            reply: "Message is required",
        })
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful, concise AI assistant for a website.",
                },
                {
                    role: "user",
                    content: message,
                },
            ],
        })

        return res.status(200).json({
            reply: response.choices[0].message.content,
        })
    } catch (error) {
        console.error("OpenAI error:", error)

        return res.status(500).json({
            reply:
                "AI service is temporarily unavailable. Please try again later.",
        })
    }
}
