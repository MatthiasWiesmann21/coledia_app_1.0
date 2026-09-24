"use client";

import { useEffect } from "react";

/** Last-resort error boundary (errors in the root layout). Must render <html>. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 420 }}>
          The application failed to load. Please try again in a moment.
        </p>
        {error.digest && (
          <p style={{ fontSize: 12, color: "#6b7280" }}>Error reference: {error.digest}</p>
        )}
        <button
          onClick={reset}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "white",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
