import OpenAI from "openai"

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") return res.status(200).end()
    if (req.method !== "POST")
        return res.status(405).json({ reply: "Method not allowed" })

    // 🔍 DEBUG: check env variable
    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
            reply: "OPENAI_API_KEY is missing in Vercel",
        })
    }

    return res.status(200).json({
        reply: "API key loaded successfully",
    })
}
