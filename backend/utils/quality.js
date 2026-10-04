// coerce to a number or null
const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

/**
 * Rule-based milk quality grading.
 * Returns { grade: "Good"|"Average"|"Poor", score: 0-100, reasons: [] }
 */
function evaluateQuality(input) {
  const fat = num(input.fat);
  const snf = num(input.snf);
  const protein = num(input.protein);
  const temperature = num(input.temperature);

  const reasons = [];
  let score = 100;

  if (fat !== null) {
    if (fat < 3.0) { score -= 30; reasons.push("Fat is low (below 3.0%)"); }
    else if (fat < 3.5) { score -= 12; reasons.push("Fat slightly below ideal (3.5%)"); }
  }

  if (snf !== null) {
    if (snf < 8.0) { score -= 30; reasons.push("SNF is low (below 8.0%)"); }
    else if (snf < 8.5) { score -= 12; reasons.push("SNF slightly below ideal (8.5%)"); }
  }

  if (protein !== null) {
    if (protein < 2.8) { score -= 15; reasons.push("Protein is low (below 2.8%)"); }
  }

  if (temperature !== null) {
    if (temperature > 8) { score -= 25; reasons.push("Temperature too high — spoilage risk"); }
    else if (temperature > 6) { score -= 10; reasons.push("Temperature above cold-chain ideal (2–6°C)"); }
  }

  score = Math.max(0, score);

  let grade = "Good";
  if (score < 60) grade = "Poor";
  else if (score < 82) grade = "Average";

  if (reasons.length === 0) reasons.push("All parameters within healthy range");

  return { grade, score, reasons };
}

module.exports = { evaluateQuality, num };