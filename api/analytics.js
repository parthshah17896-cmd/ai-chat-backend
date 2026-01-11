const stats = {
    first_text: 0,
    left_on_read: 0,
    breakup: 0,
}

export default function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).end()
    }

    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", () => {
        try {
            const { scenario } = JSON.parse(body || "{}")
            if (stats[scenario] !== undefined) {
                stats[scenario] += 1
            }
        } catch {}
        res.status(200).json({ ok: true })
    })
}
