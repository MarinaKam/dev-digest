import React from "react";

/** On/off switch. Other button attributes (`aria-label`, `disabled`) pass through. */
export function Toggle({
  on,
  onChange,
  size = 18,
  disabled,
  ...rest
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  size?: number;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "onClick" | "role" | "style">) {
  return (
    <button
      {...rest}
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      style={{
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        width: size * 1.85,
        height: size + 4,
        borderRadius: 99,
        border: "none",
        padding: 2,
        background: on ? "var(--accent)" : "var(--border-strong)",
        transition: "background .15s",
        position: "relative",
      }}
    >
      <span
        style={{
          display: "block",
          width: size,
          height: size,
          borderRadius: 99,
          background: "#fff",
          transform: on ? `translateX(${size * 0.85}px)` : "none",
          transition: "transform .15s",
          boxShadow: "0 1px 3px rgba(0,0,0,.3)",
        }}
      />
    </button>
  );
}
