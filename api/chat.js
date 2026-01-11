import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export default async function handler(req, res) {
    // 🔐 CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    // Preflight
    if (req.method === "OPTIONS") {
        return res.status(200).end()
    }

    // Only POST
    if (req.method !== "POST") {
        return res.status(405).json({ reply: "Method not allowed" })
    }

    // ✅ Manual body parsing (this part is correct and stays)
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
        // ✅ THIS is the critical fix
        const model = genAI.getGenerativeModel({
            model: "gemini-pro",
        })

        const result = await model.generateContent(message)
        const response = await result.response
        const text = response.text()

        return res.status(200).json({
            reply: text,
        })
    } catch (error) {
        console.error("Gemini error:", error)

        return res.status(500).json({
            reply:
                "Gemini API error. Please try again after some time.",
        })
    }
}
