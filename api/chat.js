import OpenAI from "openai"
import { GoogleGenerativeAI } from "@google/generative-ai"

/*
  Choose provider using Vercel Environment Variable:
  AI_PROVIDER = "gemini" | "openai"
*/
const PROVIDER = process.env.AI_PROVIDER || "gemini"

// OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

// Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export default async function handler(req, res) {
    // 🔐 CORS headers (REQUIRED)
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    // ✅ Preflight
    if (req.method === "OPTIONS") {
        return res.status(200).end()
    }

    // ❌ Only POST allowed
    if (req.method !== "POST") {
        return res.status(405).json({ reply: "Method not allowed" })
    }

    // ✅ Manual body parsing (KEEP – this is why your setup works)
    let body = ""
    await new Promise((resolve) => {
        req.on("data", (chunk) => {
            body += chunk
        })
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
        // =========================
        // 🤖 GEMINI (FREE)
        // =========================
        if (PROVIDER === "gemini") {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error("GEMINI_API_KEY missing")
            }

            const model = genAI.getGenerativeModel({
                model: "gemini-pro",
            })

            const result = await model.generateContent(message)
            const text = result.response.text()

            return res.status(200).json({ reply: text })
        }

        // =========================
        // 🤖 OPENAI
        // =========================
        if (PROVIDER === "openai") {
            if (!process.env.OPENAI_API_KEY) {
                throw new Error("OPENAI_API_KEY missing")
            }

            const completion = await openai.chat.completions.create({
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
                reply: completion.choices[0].message.content,
            })
        }

        return res.status(400).json({
            reply: "Invalid AI_PROVIDER value",
        })
    } catch (error) {
        console.error("AI error:", error)

        return res.status(500).json({
            reply:
                "AI service is temporarily unavailable. Please try again later.",
        })
    }
}
