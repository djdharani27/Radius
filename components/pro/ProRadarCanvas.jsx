"use client";

import { useEffect, useRef } from "react";

const SIZE = 640;
const CENTER = SIZE / 2;
const OUTER_RADIUS = SIZE / 2 - 18;
const AXIS_LABELS = [
  { text: "North", x: CENTER, y: 34 },
  { text: "East", x: SIZE - 38, y: CENTER + 5 },
  { text: "South", x: CENTER, y: SIZE - 18 },
  { text: "West", x: 38, y: CENTER + 5 },
];

function getProfessionalPosition(peer, index, rangeMeters) {
  const safeRange = Math.max(rangeMeters, 1);
  const ratio = Math.min((peer.dist || 0) / safeRange, 1);
  const angle = ((index * 43 + (peer.name?.length || 0) * 11) % 360) * (Math.PI / 180);
  const radius = 58 + ratio * (OUTER_RADIUS - 92);

  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
    radius,
  };
}

export default function ProRadarCanvas({ peers, rangeMeters }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const pulseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function drawGrid() {
      ctx.clearRect(0, 0, SIZE, SIZE);

      const bg = ctx.createRadialGradient(CENTER, CENTER, 30, CENTER, CENTER, OUTER_RADIUS);
      bg.addColorStop(0, "rgba(255,255,255,0.98)");
      bg.addColorStop(0.6, "rgba(248,250,252,0.95)");
      bg.addColorStop(1, "rgba(226,232,240,0.96)");
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, OUTER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = bg;
      ctx.fill();

      [0.25, 0.5, 0.75, 1].forEach((factor, index) => {
        ctx.beginPath();
        ctx.arc(CENTER, CENTER, OUTER_RADIUS * factor, 0, Math.PI * 2);
        ctx.strokeStyle = index === 3 ? "rgba(37,99,235,0.18)" : "rgba(148,163,184,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      ctx.strokeStyle = "rgba(148,163,184,0.18)";
      ctx.lineWidth = 1;
      [
        [CENTER, CENTER - OUTER_RADIUS, CENTER, CENTER + OUTER_RADIUS],
        [CENTER - OUTER_RADIUS, CENTER, CENTER + OUTER_RADIUS, CENTER],
      ].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      ctx.save();
      ctx.setLineDash([5, 8]);
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, OUTER_RADIUS * 0.58, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(37,99,235,0.16)";
      ctx.stroke();
      ctx.restore();

      ctx.font = "600 14px var(--mono, monospace)";
      ctx.fillStyle = "rgba(71,85,105,0.72)";
      ctx.textAlign = "center";
      AXIS_LABELS.forEach(({ text, x, y }) => {
        ctx.fillText(text, x, y);
      });

      ctx.font = "600 16px var(--mono, monospace)";
      ctx.fillStyle = "rgba(37,99,235,0.7)";
      const label = rangeMeters < 1000 ? `${rangeMeters} m range` : `${(rangeMeters / 1000).toFixed(1)} km range`;
      ctx.fillText(label, CENTER, CENTER - OUTER_RADIUS * 0.58 - 12);
    }

    function drawPeers() {
      const pulse = (Math.sin(pulseRef.current) + 1) / 2;

      peers.forEach((peer, index) => {
        const { x, y, radius } = getProfessionalPosition(peer, index, rangeMeters);
        const markerRadius = 6 + (1 - Math.min(radius / OUTER_RADIUS, 1)) * 5;

        ctx.beginPath();
        ctx.arc(x, y, markerRadius + pulse * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(37,99,235,0.09)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, markerRadius, 0, Math.PI * 2);
        ctx.fillStyle = "#2563eb";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, markerRadius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      });
    }

    function drawCenter() {
      const pulse = (Math.sin(pulseRef.current * 0.9) + 1) / 2;

      ctx.beginPath();
      ctx.arc(CENTER, CENTER, 28 + pulse * 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(15,23,42,0.06)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(CENTER, CENTER, 16, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(CENTER, CENTER, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }

    function render() {
      drawGrid();
      drawPeers();
      drawCenter();
      pulseRef.current += 0.045;
      frameRef.current = requestAnimationFrame(render);
    }

    render();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [peers, rangeMeters]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
