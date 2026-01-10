export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") {
        return res.status(200).end()
    }

    if (req.method !== "POST") {
        return res.status(405).json({ reply: "Method not allowed" })
    }

    let body = ""

    await new Promise((resolve) => {
        req.on("data", (chunk) => {
            body += chunk
        })
        req.on("end", resolve)
    })

    const parsed = JSON.parse(body || "{}")
    const message = parsed.message || "No message received"

    return res.status(200).json({
        reply: `Backend connected. You said: ${message}`,
    })
}
