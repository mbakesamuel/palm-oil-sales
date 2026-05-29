export default function handler(req, res) {
  if (process.env.DATABASE_URL) {
    res.status(200).json({ DATABASE_URL: "set" });
  } else {
    res.status(200).json({ DATABASE_URL: "missing" });
  }
}
