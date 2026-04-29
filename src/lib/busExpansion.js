/**
 * Turn AI-friendly bus output into the canvas-internal anchor format.
 *
 * The AI is told to emit:
 *   - one barrier with environmentKind:'bus' (x1/y1/x2/y2, portCount, label)
 *   - device nodes above/below the backbone
 *   - links whose target (or source) is the bus barrier id, with busId + busPortIndex
 *
 * The canvas, however, expects every bus tap to be backed by a synthetic
 * "bus anchor" node (isBusAnchor:true) sitting at the actual port position,
 * with the link connecting the real device to that anchor and carrying
 * targetBusAnchorId. This helper performs that rewrite once, after layout,
 * so neither the LLM nor the local generator has to know about it.
 */

const NODE_HW = 45;
const NODE_HH = 28;

function clampPortCount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 8;
  return Math.min(64, Math.max(2, Math.round(n)));
}

function busEndpoints(bus) {
  const x1 = bus.x1 ?? bus.x ?? 0;
  const y1 = bus.y1 ?? bus.y ?? 0;
  const x2 = bus.x2 ?? (bus.x ?? 0) + (bus.dx || 0);
  const y2 = bus.y2 ?? (bus.y ?? 0) + (bus.dy || 0);
  return { x1, y1, x2, y2 };
}

function portAnchor(bus, index, portCount) {
  const { x1, y1, x2, y2 } = busEndpoints(bus);
  const t = portCount === 1 ? 0.5 : (index + 0.5) / portCount;
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
}

export function expandBusLinksForCanvas(topology) {
  if (!topology) return topology;
  const barriers = Array.isArray(topology.barriers) ? topology.barriers : [];
  const buses = barriers.filter((b) => b && b.environmentKind === 'bus');
  if (buses.length === 0) return topology;

  const busById = new Map(buses.map((b) => [b.id, b]));
  const portCountById = new Map(buses.map((b) => [b.id, clampPortCount(b.portCount)]));
  const usedPorts = new Map(buses.map((b) => [b.id, new Set()]));

  const newNodes = [...(topology.nodes || [])];
  const newLinks = [];
  let anchorSeq = 0;
  const stamp = Date.now().toString(36);

  for (const link of topology.links || []) {
    if (!link) continue;

    // Already canvas-shaped — leave it alone.
    if (link.targetBusAnchorId || link.sourceBusAnchorId) {
      newLinks.push(link);
      continue;
    }

    const busRefId =
      (link.busId && busById.has(link.busId) && link.busId) ||
      (busById.has(link.target) && link.target) ||
      (busById.has(link.source) && link.source) ||
      null;

    if (!busRefId) {
      newLinks.push(link);
      continue;
    }

    const bus = busById.get(busRefId);
    const cap = portCountById.get(busRefId);
    const used = usedPorts.get(busRefId);

    // Prefer the AI's explicit port if it's in range and still free.
    let portIndex = null;
    const aiIdx = link.busPortIndex;
    if (Number.isInteger(aiIdx) && aiIdx >= 0 && aiIdx < cap && !used.has(aiIdx)) {
      portIndex = aiIdx;
    } else {
      for (let i = 0; i < cap; i += 1) {
        if (!used.has(i)) { portIndex = i; break; }
      }
    }
    if (portIndex === null) continue; // bus full — drop excess taps
    used.add(portIndex);

    const realDeviceId =
      link.source === busRefId ? link.target :
      link.target === busRefId ? link.source :
      (busById.has(link.source) ? link.target : link.source);
    if (!realDeviceId) continue;

    const { x: ax, y: ay } = portAnchor(bus, portIndex, cap);
    anchorSeq += 1;
    const anchorId = `bn_ai_${stamp}_${anchorSeq}`;

    newNodes.push({
      id: anchorId,
      type: 'switch',
      label: `Bus tap (${bus.label || 'Bus'})`,
      x: ax - NODE_HW,
      y: ay - NODE_HH,
      ip: '',
      vlan: null,
      isBusAnchor: true,
      busId: bus.id,
      busPortIndex: portIndex,
    });

    const linkType = link.type === 'fiber' ? 'fiber' : 'ethernet';
    newLinks.push({
      ...link,
      source: realDeviceId,
      target: anchorId,
      type: linkType,
      label: link.label || 'Bus',
      busId: bus.id,
      busPortIndex: portIndex,
      targetBusAnchorId: anchorId,
    });
  }

  return { ...topology, nodes: newNodes, links: newLinks };
}
