/**
 * Deterministic demo topology for the Generate action (local-only app).
 */
export function getLocalStubTopology(userPrompt) {
  const hint = (userPrompt || 'Demo network').trim().slice(0, 120);
  return {
    summary: `Demo topology from your prompt: "${hint}"`,
    nodes: [
      { id: 'n1', type: 'cloud', label: 'Internet', x: 220, y: 50, ip: '', vlan: null },
      { id: 'n2', type: 'router', label: 'Edge router', x: 220, y: 160, ip: '203.0.113.1', vlan: 'WAN' },
      { id: 'n3', type: 'switch', label: 'Core switch', x: 120, y: 300, ip: '10.0.0.2', vlan: 'LAN' },
      { id: 'n4', type: 'switch', label: 'Access switch', x: 320, y: 300, ip: '10.0.0.3', vlan: 'LAN' },
      { id: 'n5', type: 'ap', label: 'Wi-Fi AP', x: 80, y: 440, ip: '10.0.10.10', vlan: 'WiFi' },
      { id: 'n6', type: 'server', label: 'App server', x: 260, y: 440, ip: '10.0.20.5', vlan: 'Servers' },
      { id: 'n7', type: 'pc', label: 'Workstation', x: 400, y: 440, ip: '10.0.10.50', vlan: 'WiFi' },
    ],
    links: [
      { id: 'l1', source: 'n1', target: 'n2', type: 'wan', label: 'ISP' },
      { id: 'l2', source: 'n2', target: 'n3', type: 'fiber', label: 'Uplink' },
      { id: 'l3', source: 'n2', target: 'n4', type: 'fiber', label: 'Uplink' },
      { id: 'l4', source: 'n3', target: 'n5', type: 'ethernet', label: '' },
      { id: 'l5', source: 'n3', target: 'n6', type: 'ethernet', label: '' },
      { id: 'l6', source: 'n4', target: 'n7', type: 'ethernet', label: '' },
    ],
    rooms: [
      { id: 'r1', label: 'Server / IDF', x: 40, y: 380, w: 520, h: 200, color: 'rgba(59,130,246,0.08)' },
    ],
    vlans: [
      { id: 'v1', name: 'WAN', label: 'WAN', color: '#64748b', subnet: '203.0.113.0/29' },
      { id: 'v2', name: 'LAN', label: 'LAN', color: '#3b82f6', subnet: '10.0.0.0/24' },
      { id: 'v3', name: 'WiFi', label: 'Wi-Fi', color: '#8b5cf6', subnet: '10.0.10.0/24' },
      { id: 'v4', name: 'Servers', label: 'Servers', color: '#10b981', subnet: '10.0.20.0/24' },
    ],
  };
}
