"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GraphData,
  GraphNode,
  LABEL_COLORS,
  LABEL_DISPLAY,
  NodeLabel,
} from "@/lib/agent/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface FGNode extends GraphNode {
  x?: number;
  y?: number;
  degree: number;
}

interface Props {
  graph: GraphData;
  live?: boolean;
  onSelect?: (node: GraphNode | null) => void;
}

const SURFACE = "#111110";

function drawShape(
  ctx: CanvasRenderingContext2D,
  label: NodeLabel,
  x: number,
  y: number,
  r: number,
) {
  ctx.beginPath();
  switch (label) {
    case "Company":
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      break;
    case "Investor": // diamond
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.2, y);
      ctx.lineTo(x, y + r * 1.2);
      ctx.lineTo(x - r * 1.2, y);
      ctx.closePath();
      break;
    case "Technology": // triangle
      ctx.moveTo(x, y - r * 1.25);
      ctx.lineTo(x + r * 1.15, y + r * 0.85);
      ctx.lineTo(x - r * 1.15, y + r * 0.85);
      ctx.closePath();
      break;
    case "Market": // hexagon
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * 1.2 * Math.cos(a);
        const py = y + r * 1.2 * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    case "CustomerSegment": // square
      ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
  }
}

export function GraphLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {(Object.keys(LABEL_COLORS) as NodeLabel[]).map((label) => (
        <span
          key={label}
          className="flex items-center gap-1.5 text-[11px] text-ink-3"
        >
          <LegendGlyph label={label} />
          {LABEL_DISPLAY[label]}
        </span>
      ))}
    </div>
  );
}

function LegendGlyph({ label }: { label: NodeLabel }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 14, 14);
    ctx.fillStyle = LABEL_COLORS[label];
    drawShape(ctx, label, 7, 7, 4.2);
    ctx.fill();
  }, [label]);
  return <canvas ref={ref} width={14} height={14} />;
}

export function GraphView({ graph, live, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 600, height: 480 });
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(width, 100), height: Math.max(height, 100) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const data = useMemo(() => {
    const degree = new Map<string, number>();
    for (const l of graph.links) {
      degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
      degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
    }
    return {
      nodes: graph.nodes.map((n) => ({ ...n, degree: degree.get(n.id) ?? 0 })),
      links: graph.links.map((l) => ({ ...l })),
    };
  }, [graph]);

  // Frame all nodes into view. Critical for the saved-analysis page, where the
  // full graph mounts and cools before the ResizeObserver reports real size.
  const fitToView = useCallback(() => {
    // Fit settled/static graphs only; leave the live-streaming dashboard as-is.
    if (!live && data.nodes.length) fgRef.current?.zoomToFit(400, 60);
  }, [live, data.nodes.length]);

  // Re-fit after the container is sized (mount-time size race) and when a
  // static graph's data changes. Skip during live streaming to avoid jitter.
  useEffect(() => {
    if (live || !data.nodes.length) return;
    const t = setTimeout(() => fgRef.current?.zoomToFit(300, 60), 80);
    return () => clearTimeout(t);
  }, [size, data, live]);

  const neighborhood = useMemo(() => {
    if (!selected) return null;
    const ids = new Set<string>([selected]);
    for (const l of graph.links) {
      if (l.source === selected) ids.add(l.target);
      if (l.target === selected) ids.add(l.source);
    }
    return ids;
  }, [selected, graph.links]);

  const paintNode = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const r = 3 + Math.min(Math.sqrt(node.degree + 1) * 1.6, 8);
      const color = LABEL_COLORS[node.label];
      const dimmed = neighborhood ? !neighborhood.has(node.id) : false;
      const emphasized = node.id === selected || node.id === hovered;

      ctx.globalAlpha = dimmed ? 0.15 : 1;
      // 2px surface ring so overlapping marks stay separable
      ctx.fillStyle = SURFACE;
      drawShape(ctx, node.label, node.x!, node.y!, r + 2 / globalScale);
      ctx.fill();
      ctx.fillStyle = color;
      drawShape(ctx, node.label, node.x!, node.y!, r);
      ctx.fill();
      if (emphasized) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5 / globalScale;
        drawShape(ctx, node.label, node.x!, node.y!, r + 1 / globalScale);
        ctx.stroke();
      }

      // Direct labels: hubs always, everything once zoomed in
      const showLabel = emphasized || globalScale > 1.8 || node.degree >= 6;
      if (showLabel && !dimmed) {
        const fontSize = Math.max(11 / globalScale, 2.4);
        ctx.font = `500 ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = emphasized ? "#ffffff" : "#c3c2b7";
        ctx.fillText(node.name, node.x!, node.y! + r + 3 / globalScale);
      }
      ctx.globalAlpha = 1;
    },
    [neighborhood, selected, hovered],
  );

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <ForceGraph2D
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={fgRef as any}
        width={size.width}
        height={size.height}
        graphData={data}
        backgroundColor={SURFACE}
        nodeId="id"
        nodeLabel={(n) => {
          const node = n as FGNode;
          return `<div style="padding:6px 9px;background:#232322;border:1px solid #33332f;border-radius:8px;font-size:12px;max-width:230px">
            <span style="color:${LABEL_COLORS[node.label]};font-size:10px;letter-spacing:.05em">${LABEL_DISPLAY[node.label].toUpperCase()}</span><br/>
            <strong style="color:#fff">${node.name}</strong>
            ${node.tagline ? `<br/><span style="color:#8a897f">${node.tagline}</span>` : ""}
          </div>`;
        }}
        nodeCanvasObject={(n, ctx, scale) => paintNode(n as FGNode, ctx, scale)}
        nodePointerAreaPaint={(n, color, ctx) => {
          const node = n as FGNode;
          const r = 3 + Math.min(Math.sqrt(node.degree + 1) * 1.6, 8);
          ctx.fillStyle = color;
          // generous hit target
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, r + 5, 0, 2 * Math.PI);
          ctx.fill();
        }}
        onNodeHover={(n) => setHovered((n as FGNode | null)?.id ?? null)}
        onNodeClick={(n) => {
          const node = n as FGNode;
          const next = selected === node.id ? null : node.id;
          setSelected(next);
          onSelect?.(next ? node : null);
        }}
        onBackgroundClick={() => {
          setSelected(null);
          onSelect?.(null);
        }}
        linkColor={(l) => {
          const link = l as {
            source: FGNode | string;
            target: FGNode | string;
          };
          if (!neighborhood) return "#33332f";
          const s =
            typeof link.source === "string" ? link.source : link.source.id;
          const t =
            typeof link.target === "string" ? link.target : link.target.id;
          return neighborhood.has(s) && neighborhood.has(t)
            ? "#6a6a64"
            : "#22221f";
        }}
        linkWidth={1}
        linkDirectionalParticles={live ? 1 : 0}
        linkDirectionalParticleWidth={1.6}
        linkDirectionalParticleSpeed={0.006}
        cooldownTicks={live ? 200 : 120}
        onEngineStop={fitToView}
        d3AlphaDecay={0.025}
        d3VelocityDecay={0.35}
        enableNodeDrag
      />
    </div>
  );
}
