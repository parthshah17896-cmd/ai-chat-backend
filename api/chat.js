export default function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method !== "POST") {
        return res.status(405).json({ reply: "Method not allowed" })
    }

    const { message } = req.body

    return res.status(200).json({
        reply: `Connected successfully. You said: ${message}`,
    })
}
