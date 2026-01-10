export default async function handler(req, res) {
    // 🔐 CORS headers (MANDATORY)
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    // ✅ Handle preflight request
    if (req.method === "OPTIONS") {
        return res.status(200).end()
    }

    // ❌ Block everything except POST
    if (req.method !== "POST") {
        return res.status(405).json({ reply: "Method not allowed" })
    }

    // ✅ Parse body safely
    let body = ""
    await new Promise((resolve) => {
        req.on("data", (chunk) => {
            body += chunk
        })
        req.on("end", resolve)
    })

    const parsed = JSON.parse(body || "{}")
    const message = parsed.message || "No message"

    // ✅ Always return JSON
    return res.status(200).json({
        reply: `CORS fixed. You said: ${message}`,
    })
}
