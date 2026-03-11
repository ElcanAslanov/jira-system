"use client";

import React from "react";

export default class DebugErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { error };
  }

  componentDidCatch(error: any, info: any) {
    console.error("💥 REACT CRASH:", error);
    console.error("STACK:", info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40 }}>
          <h1 style={{ color: "red", fontWeight: "bold" }}>
            React Crash
          </h1>

          <pre
            style={{
              background: "#111",
              color: "#0f0",
              padding: 20,
              overflow: "auto",
              borderRadius: 8
            }}
          >
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}