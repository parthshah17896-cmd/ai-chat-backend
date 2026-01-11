export default async function handler(req, res) {
    // 🔐 CORS
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") return res.status(200).end()
    if (req.method !== "POST")
        return res.status(405).json({ reply: "Method not allowed" })

    // 🔑 Ensure API key exists
    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({
            reply: "GROQ_API_KEY missing in Vercel",
        })
    }

    // ✅ Parse body safely
    let body = ""
    await new Promise((resolve) => {
        req.on("data", (chunk) => (body += chunk))
        req.on("end", resolve)
    })

    const parsed = JSON.parse(body || "{}")
    const message =
        parsed.message ||
        parsed.input ||
        parsed.text ||
        parsed.query ||
        ""

    if (!message) {
        return res.status(400).json({
            reply: "Message is required",
        })
    }

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
                    messages: [{ role: "user", content: message }],
                }),
            }
        )

        if (!groqResponse.ok) {
            const errText = await groqResponse.text()
            throw new Error(errText)
        }

        const data = await groqResponse.json()

        return res.status(200).json({
            reply: data.choices[0].message.content,
        })
    } catch (error) {
        console.error("Groq error:", error)

        return res.status(500).json({
            reply: "Groq API failed. Please try again.",
        })
    }
}
