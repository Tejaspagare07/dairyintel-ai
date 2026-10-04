import { useRef } from "react";

// 6 boxes, auto-advance, backspace to previous, paste a full code into any box.
export default function OtpInput({ value, onChange, disabled, autoFocus = true }) {
  const refs = useRef([]);
  const digits = (value + "      ").slice(0, 6).split("");

  const setAt = (i, d) => {
    const arr = digits.map((c) => (c === " " ? "" : c));
    arr[i] = d;
    onChange(arr.join("").slice(0, 6));
  };
  const handle = (i, e) => {
    const v = e.target.value.replace(/\D/g, "");
    if (v.length > 1) { // paste or autofill
      onChange(v.slice(0, 6));
      refs.current[Math.min(v.length, 6) - 1]?.focus();
      return;
    }
    setAt(i, v);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };
  const key = (i, e) => {
    if (e.key === "Backspace" && !digits[i].trim() && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div className="otp-row" role="group" aria-label="6-digit verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`otp-box ${d.trim() ? "filled" : ""}`}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={6}
          value={d.trim()}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handle(i, e)}
          onKeyDown={(e) => key(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
