"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import BrandMark from "@/components/BrandMark";

export default function StartupLoader() {
  const [visible, setVisible] = useState(true);
  const [closing, setClosing] = useState(false);
  const dismissTimer = useRef<number | null>(null);
  const closingRef = useRef(false);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    dismissTimer.current = window.setTimeout(() => setVisible(false), 260);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(false);
      return;
    }

    const startupTimer = window.setTimeout(dismiss, 760);
    return () => {
      window.clearTimeout(startupTimer);
      if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
    };
  }, [dismiss]);

  if (!visible) return null;

  return (
    <div
      className={`startup-loader${closing ? " is-closing" : ""}`}
      role="status"
      aria-label="Loading Code Archaeologist"
    >
      <div className="startup-loader-scene" aria-hidden="true">
        <span className="startup-loader-orbit startup-loader-orbit-one" />
        <span className="startup-loader-orbit startup-loader-orbit-two" />
        <span className="startup-loader-orbit startup-loader-orbit-three" />
        <span className="startup-loader-node startup-loader-node-one" />
        <span className="startup-loader-node startup-loader-node-two" />
        <span className="startup-loader-node startup-loader-node-three" />
        <div className="startup-loader-mark">
          <BrandMark className="brand-mark-art" />
        </div>
      </div>
      <p className="startup-loader-title">Code Archaeologist</p>
      <p className="startup-loader-caption">Preparing your workspace</p>
      <div className="startup-loader-progress" aria-hidden="true">
        <span />
      </div>
      <button className="startup-loader-skip" type="button" onClick={dismiss}>
        Skip intro
      </button>
    </div>
  );
}
