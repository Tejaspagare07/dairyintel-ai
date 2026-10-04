// Express-5-safe NoSQL injection guard.
// Recursively strips keys starting with "$" or containing "." from req.body,
// which blocks Mongo operator injection (e.g. { "email": { "$gt": "" } }).
// We intentionally only touch req.body (req.query/req.params are read-only in Express 5).
function clean(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(clean);
  const out = {};
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) continue; // drop dangerous keys
    out[key] = clean(obj[key]);
  }
  return out;
}

module.exports = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = clean(req.body);
  }
  next();
};
