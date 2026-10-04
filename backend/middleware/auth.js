const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = header.split(" ")[1]; // "Bearer xxx" -> "xxx"

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // now routes know { id, role }
    next(); // continue to the actual route
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};