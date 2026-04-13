"use client";

import { useEffect, useRef } from "react";
import { haversineMeters } from "@/lib/geo";

const W = 600;
const CX = W / 2;
const CY = W / 2;
const R = W / 2 - 4;

/**
 * Animated radar canvas.
 * Renders sweep line + dots for nearby users.
 */
export default function RadarCanvas({ userLat, userLng, peers, rangeMeters }) {
  const canvasRef = useRef(null);
  const angleRef = useRef(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function draw() {
      ctx.clearRect(0, 0, W, W);

      // Background circle
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, Math.PI * 2);
      ctx.fillStyle = "#0a1019";
      ctx.fill();

      // Rings
      [0.25, 0.5, 0.75, 1].forEach((f) => {
        ctx.beginPath();
        ctx.arc(CX, CY, R * f, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,255,140,0.07)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Crosshair lines
      ctx.strokeStyle = "rgba(0,255,140,0.05)";
      ctx.lineWidth = 1;
      [
        [CX, CY - R, CX, CY + R],
        [CX - R, CY, CX + R, CY],
      ].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      // Sweep
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(angleRef.current);

      const grad = ctx.createLinearGradient(0, 0, R, 0);
      grad.addColorStop(0, "rgba(0,255,140,0)");
      grad.addColorStop(0.5, "rgba(0,255,140,0.03)");
      grad.addColorStop(1, "rgba(0,255,140,0.16)");
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, -0.45, 0.45);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(R, 0);
      ctx.strokeStyle = "rgba(0,255,140,0.75)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#00ff8c";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();

      // Range ring (dashed)
      ctx.beginPath();
      ctx.arc(CX, CY, R * 0.42, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,255,140,0.18)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Peer dots
      if (userLat && userLng) {
        const maxPlot = rangeMeters * 2.4;

        peers.forEach((p) => {
          const dist = haversineMeters(userLat, userLng, p.lat, p.lng);
          if (dist > maxPlot) return;

          const ratio = Math.min(dist / maxPlot, 1);
          const dLat = p.lat - userLat;
          const dLng = p.lng - userLng;
          const mag = Math.sqrt(dLat ** 2 + dLng ** 2) || 1;
          const px = CX + (dLng / mag) * ratio * R * 0.92;
          const py = CY - (dLat / mag) * ratio * R * 0.92;

          const inRange = dist <= rangeMeters;
          ctx.shadowBlur = inRange ? 10 : 0;
          ctx.shadowColor = "#00ff8c";

          ctx.beginPath();
          ctx.arc(px, py, inRange ? 5 : 3, 0, Math.PI * 2);
          ctx.fillStyle = inRange ? "#00ff8c" : "#5a7a60";
          ctx.fill();

          if (inRange) {
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(px, py, 10, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(0,255,140,0.22)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          ctx.shadowBlur = 0;
        });
      }

      // Center dot (user)
      ctx.shadowColor = "#00ff8c";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(CX, CY, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#00ff8c";
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(CX, CY, 16, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,255,140,0.28)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Range label
      ctx.font = "20px 'Share Tech Mono', monospace";
      ctx.fillStyle = "rgba(0,255,140,0.28)";
      ctx.textAlign = "right";
      const label =
        rangeMeters < 1000
          ? `${rangeMeters}m`
          : `${(rangeMeters / 1000).toFixed(1)}km`;
      ctx.fillText(label, CX + R * 0.42 - 6, CY - 8);

      angleRef.current += 0.022;
      if (angleRef.current > Math.PI * 2) angleRef.current -= Math.PI * 2;

      frameRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [userLat, userLng, peers, rangeMeters]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={W}
      style={{ width: "100%", height: "100%", borderRadius: "50%", display: "block" }}
    />
  );
}
