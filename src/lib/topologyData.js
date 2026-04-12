// Device type definitions
export const DEVICE_TYPES = {
    router: {
      label: 'Router',
      icon: '🌐',
      color: '#06b6d4',
      shape: 'hexagon',
      defaultPorts: ['WAN', 'LAN1', 'LAN2', 'LAN3'],
    },
    switch: {
      label: 'Switch',
      icon: '🔀',
      color: '#3b82f6',
      shape: 'rect',
      defaultPorts: ['Port1', 'Port2', 'Port3', 'Port4', 'Port5', 'Port6', 'Port7', 'Port8'],
    },
    ap: {
      label: 'Access Point',
      icon: '📡',
      color: '#8b5cf6',
      shape: 'circle',
      defaultPorts: ['Uplink', 'LAN'],
    },
    server: {
      label: 'Server',
      icon: '🖥️',
      color: '#10b981',
      shape: 'rect',
      defaultPorts: ['ETH0', 'ETH1'],
    },
    firewall: {
      label: 'Firewall',
      icon: '🛡️',
      color: '#ef4444',
      shape: 'diamond',
      defaultPorts: ['WAN', 'LAN', 'DMZ'],
    },
    cloud: {
      label: 'Cloud/ISP',
      icon: '☁️',
      color: '#64748b',
      shape: 'cloud',
      defaultPorts: ['Link1', 'Link2'],
    },
    pc: {
      label: 'Workstation',
      icon: '🖥',
      color: '#f59e0b',
      shape: 'rect',
      defaultPorts: ['ETH0'],
    },
    laptop: {
      label: 'Laptop',
      icon: '💻',
      color: '#f59e0b',
      shape: 'rect',
      defaultPorts: ['WiFi', 'ETH0'],
    },
    printer: {
      label: 'Printer',
      icon: '🖨️',
      color: '#6b7280',
      shape: 'rect',
      defaultPorts: ['ETH0', 'WiFi'],
    },
    camera: {
      label: 'IP Camera',
      icon: '📷',
      color: '#ec4899',
      shape: 'circle',
      defaultPorts: ['ETH0'],
    },
    nas: {
      label: 'NAS Storage',
      icon: '💾',
      color: '#0891b2',
      shape: 'rect',
      defaultPorts: ['ETH0', 'ETH1'],
    },
    phone: {
      label: 'VoIP Phone',
      icon: '📞',
      color: '#7c3aed',
      shape: 'rect',
      defaultPorts: ['ETH0'],
    },
    loadbalancer: {
      label: 'Load Balancer',
      icon: '⚖️',
      color: '#06b6d4',
      shape: 'rect',
      defaultPorts: ['WAN', 'LAN1', 'LAN2'],
    },
    tablet: {
      label: 'Tablet',
      icon: '📱',
      color: '#f59e0b',
      shape: 'rect',
      defaultPorts: ['WiFi'],
    },
    iot: {
      label: 'IoT Gateway',
      icon: '🔌',
      color: '#10b981',
      shape: 'rect',
      defaultPorts: ['ETH0', 'WiFi', 'Zigbee'],
    },
    pdu: {
      label: 'UPS / PDU',
      icon: '🔋',
      color: '#f97316',
      shape: 'rect',
      defaultPorts: ['ETH0'],
    },
    patchpanel: {
      label: 'Patch Panel',
      icon: '🔲',
      color: '#64748b',
      shape: 'rect',
      defaultPorts: ['Port1', 'Port2', 'Port3', 'Port4'],
    },
    smarttv: {
      label: 'Smart TV',
      icon: '📺',
      color: '#8b5cf6',
      shape: 'rect',
      defaultPorts: ['WiFi', 'ETH0'],
    },
  };

  /** v3 §63–66 Visual identity (Ethernet / WiFi / Fiber / WAN / VPN) */
  export const LINK_TYPES = {
    ethernet: { label: 'Ethernet', color: '#94A3B8', dash: false, speed: '1Gbps', widthBase: 2 },
    fiber: { label: 'Fiber', color: '#8B5CF6', dash: false, speed: '10Gbps', widthBase: 2.25, glow: true },
    wifi: { label: 'WiFi', color: '#06B6D4', dash: true, speed: '300Mbps', widthBase: 2 },
    wan: { label: 'WAN', color: '#F97316', dash: false, speed: 'Variable', widthBase: 2 },
    vpn: { label: 'VPN Tunnel', color: '#A855F7', dash: true, speed: 'Variable', widthBase: 2 },
  };

  // Mock AI topology responses
  export const MOCK_AI_RESPONSES = {
    default: (prompt) => generateMockTopology(prompt),
  };

  function generateMockTopology(prompt) {
    const lower = prompt.toLowerCase();

    if (lower.includes('office') || lower.includes('corporate')) {
      return officeTopology();
    } else if (lower.includes('home') || lower.includes('house') || lower.includes('apartment')) {
      return homeTopology();
    } else if (lower.includes('data center') || lower.includes('datacenter')) {
      return dataCenterTopology();
    } else if (lower.includes('school') || lower.includes('campus') || lower.includes('university')) {
      return campusTopology();
    } else if (lower.includes('retail') || lower.includes('store') || lower.includes('shop')) {
      return retailTopology();
    } else {
      return officeTopology();
    }
  }
  function officeTopology() {
    return {
      nodes: [
        { id: 'n1', type: 'cloud', label: 'ISP / Internet', x: 400, y: 60, ip: '203.0.113.1', vlan: null },
        { id: 'n2', type: 'firewall', label: 'Firewall', x: 400, y: 160, ip: '192.168.0.1', vlan: null },
        { id: 'n3', type: 'router', label: 'Core Router', x: 400, y: 270, ip: '192.168.1.1', vlan: null },
        { id: 'n4', type: 'switch', label: 'Core Switch', x: 400, y: 380, ip: '192.168.1.2', vlan: 'VLAN10' },
        { id: 'n5', type: 'switch', label: 'Switch - Office A', x: 200, y: 500, ip: '192.168.1.10', vlan: 'VLAN10' },
        { id: 'n6', type: 'switch', label: 'Switch - Office B', x: 600, y: 500, ip: '192.168.1.11', vlan: 'VLAN20' },
        { id: 'n7', type: 'ap', label: 'AP - Lobby', x: 400, y: 500, ip: '192.168.1.20', vlan: 'VLAN30' },
        { id: 'n8', type: 'server', label: 'File Server', x: 100, y: 620, ip: '192.168.1.100', vlan: 'VLAN10' },
        { id: 'n9', type: 'pc', label: 'Workstation 1', x: 200, y: 620, ip: '192.168.1.101', vlan: 'VLAN10' },
        { id: 'n10', type: 'pc', label: 'Workstation 2', x: 310, y: 620, ip: '192.168.1.102', vlan: 'VLAN10' },
        { id: 'n11', type: 'pc', label: 'Workstation 3', x: 530, y: 620, ip: '192.168.1.110', vlan: 'VLAN20' },
        { id: 'n12', type: 'printer', label: 'Network Printer', x: 650, y: 620, ip: '192.168.1.111', vlan: 'VLAN20' },
        { id: 'n13', type: 'laptop', label: 'Laptop (WiFi)', x: 400, y: 620, ip: '192.168.1.130', vlan: 'VLAN30' },
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n2', type: 'wan', label: 'WAN' },
        { id: 'l2', source: 'n2', target: 'n3', type: 'ethernet', label: '1Gbps' },
        { id: 'l3', source: 'n3', target: 'n4', type: 'fiber', label: '10Gbps' },
        { id: 'l4', source: 'n4', target: 'n5', type: 'ethernet', label: '1Gbps' },
        { id: 'l5', source: 'n4', target: 'n6', type: 'ethernet', label: '1Gbps' },
        { id: 'l6', source: 'n4', target: 'n7', type: 'ethernet', label: '1Gbps' },
        { id: 'l7', source: 'n5', target: 'n8', type: 'ethernet', label: '' },
        { id: 'l8', source: 'n5', target: 'n9', type: 'ethernet', label: '' },
        { id: 'l9', source: 'n5', target: 'n10', type: 'ethernet', label: '' },
        { id: 'l10', source: 'n6', target: 'n11', type: 'ethernet', label: '' },
        { id: 'l11', source: 'n6', target: 'n12', type: 'ethernet', label: '' },
        { id: 'l12', source: 'n7', target: 'n13', type: 'wifi', label: 'WiFi' },
      ],
      rooms: [
        { id: 'r1', label: 'Server Room', x: 50, y: 560, w: 320, h: 120, color: 'rgba(16,185,129,0.08)' },
        { id: 'r2', label: 'Office Area A', x: 50, y: 440, w: 320, h: 100, color: 'rgba(59,130,246,0.08)' },
        { id: 'r3', label: 'Office Area B', x: 450, y: 440, w: 320, h: 220, color: 'rgba(139,92,246,0.08)' },
        { id: 'r4', label: 'Lobby / Common', x: 330, y: 440, w: 120, h: 220, color: 'rgba(245,158,11,0.08)' },
      ],
      vlans: [
        { id: 'v1', name: 'VLAN10', label: 'Corporate', color: '#3b82f6', subnet: '192.168.1.0/24' },
        { id: 'v2', name: 'VLAN20', label: 'Operations', color: '#8b5cf6', subnet: '192.168.2.0/24' },
        { id: 'v3', name: 'VLAN30', label: 'Guest WiFi', color: '#f59e0b', subnet: '192.168.30.0/24' },
      ],
      summary: 'Corporate office network with 3 floors, firewall protection, segmented VLANs for corporate, operations, and guest access. Core switching with redundant paths.',
    };
  }

  function homeTopology() {
    return {
      nodes: [
        { id: 'n1', type: 'cloud', label: 'ISP / Internet', x: 350, y: 60, ip: '203.0.113.1', vlan: null },
        { id: 'n2', type: 'router', label: 'Home Router', x: 350, y: 180, ip: '192.168.1.1', vlan: null },
        { id: 'n3', type: 'switch', label: 'Network Switch', x: 350, y: 300, ip: '192.168.1.2', vlan: null },
        { id: 'n4', type: 'ap', label: 'WiFi AP - Main', x: 200, y: 420, ip: '192.168.1.3', vlan: null },
        { id: 'n5', type: 'ap', label: 'WiFi AP - Upstairs', x: 500, y: 420, ip: '192.168.1.4', vlan: null },
        { id: 'n6', type: 'nas', label: 'Home NAS', x: 350, y: 420, ip: '192.168.1.10', vlan: null },
        { id: 'n7', type: 'pc', label: 'Desktop PC', x: 150, y: 550, ip: '192.168.1.101', vlan: null },
        { id: 'n8', type: 'laptop', label: 'Laptop', x: 280, y: 550, ip: '192.168.1.102', vlan: null },
        { id: 'n9', type: 'laptop', label: 'Laptop 2', x: 420, y: 550, ip: '192.168.1.103', vlan: null },
        { id: 'n10', type: 'camera', label: 'IP Camera', x: 550, y: 550, ip: '192.168.1.120', vlan: null },
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n2', type: 'wan', label: 'WAN' },
        { id: 'l2', source: 'n2', target: 'n3', type: 'ethernet', label: '1Gbps' },
        { id: 'l3', source: 'n3', target: 'n4', type: 'ethernet', label: '' },
        { id: 'l4', source: 'n3', target: 'n5', type: 'ethernet', label: '' },
        { id: 'l5', source: 'n3', target: 'n6', type: 'ethernet', label: '' },
        { id: 'l6', source: 'n4', target: 'n7', type: 'wifi', label: 'WiFi' },
        { id: 'l7', source: 'n4', target: 'n8', type: 'wifi', label: 'WiFi' },
        { id: 'l8', source: 'n5', target: 'n9', type: 'wifi', label: 'WiFi' },
        { id: 'l9', source: 'n3', target: 'n10', type: 'ethernet', label: '' },
      ],
      rooms: [
        { id: 'r1', label: 'Living Room', x: 100, y: 380, w: 280, h: 240, color: 'rgba(59,130,246,0.08)' },
        { id: 'r2', label: 'Office / Study', x: 300, y: 380, w: 160, h: 120, color: 'rgba(16,185,129,0.08)' },
        { id: 'r3', label: 'Upstairs', x: 420, y: 380, w: 200, h: 240, color: 'rgba(139,92,246,0.08)' },
      ],
      vlans: [],
      summary: 'Home network with dual WiFi access points for full coverage, NAS storage, and IP cameras. Suitable for 3-bedroom house.',
    };
  }

  function dataCenterTopology() {
    return {
      nodes: [
        { id: 'n1', type: 'cloud', label: 'Internet', x: 400, y: 40, ip: '0.0.0.0/0', vlan: null },
        { id: 'n2', type: 'firewall', label: 'Firewall Cluster', x: 400, y: 140, ip: '10.0.0.1', vlan: null },
        { id: 'n3', type: 'router', label: 'Core Router A', x: 250, y: 250, ip: '10.0.1.1', vlan: null },
        { id: 'n4', type: 'router', label: 'Core Router B', x: 550, y: 250, ip: '10.0.1.2', vlan: null },
        { id: 'n5', type: 'switch', label: 'ToR Switch A1', x: 150, y: 380, ip: '10.0.2.1', vlan: 'VLAN100' },
        { id: 'n6', type: 'switch', label: 'ToR Switch A2', x: 350, y: 380, ip: '10.0.2.2', vlan: 'VLAN100' },
        { id: 'n7', type: 'switch', label: 'ToR Switch B1', x: 450, y: 380, ip: '10.0.2.3', vlan: 'VLAN200' },
        { id: 'n8', type: 'switch', label: 'ToR Switch B2', x: 650, y: 380, ip: '10.0.2.4', vlan: 'VLAN200' },
        { id: 'n9', type: 'server', label: 'Web Server 1', x: 100, y: 520, ip: '10.0.10.1', vlan: 'VLAN100' },
        { id: 'n10', type: 'server', label: 'Web Server 2', x: 210, y: 520, ip: '10.0.10.2', vlan: 'VLAN100' },
        { id: 'n11', type: 'server', label: 'App Server 1', x: 320, y: 520, ip: '10.0.10.3', vlan: 'VLAN100' },
        { id: 'n12', type: 'server', label: 'DB Server 1', x: 450, y: 520, ip: '10.0.20.1', vlan: 'VLAN200' },
        { id: 'n13', type: 'server', label: 'DB Server 2', x: 560, y: 520, ip: '10.0.20.2', vlan: 'VLAN200' },
        { id: 'n14', type: 'nas', label: 'SAN Storage', x: 670, y: 520, ip: '10.0.20.10', vlan: 'VLAN200' },
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n2', type: 'fiber', label: '40Gbps' },
        { id: 'l2', source: 'n2', target: 'n3', type: 'fiber', label: '40Gbps' },
        { id: 'l3', source: 'n2', target: 'n4', type: 'fiber', label: '40Gbps' },
        { id: 'l4', source: 'n3', target: 'n5', type: 'fiber', label: '10Gbps' },
        { id: 'l5', source: 'n3', target: 'n6', type: 'fiber', label: '10Gbps' },
        { id: 'l6', source: 'n4', target: 'n7', type: 'fiber', label: '10Gbps' },
        { id: 'l7', source: 'n4', target: 'n8', type: 'fiber', label: '10Gbps' },
        { id: 'l8', source: 'n5', target: 'n9', type: 'fiber', label: '' },
        { id: 'l9', source: 'n5', target: 'n10', type: 'fiber', label: '' },
        { id: 'l10', source: 'n6', target: 'n11', type: 'fiber', label: '' },
        { id: 'l11', source: 'n7', target: 'n12', type: 'fiber', label: '' },
        { id: 'l12', source: 'n7', target: 'n13', type: 'fiber', label: '' },
        { id: 'l13', source: 'n8', target: 'n14', type: 'fiber', label: '' },
      ],
      rooms: [
        { id: 'r1', label: 'Rack Row A - Compute', x: 80, y: 460, w: 310, h: 130, color: 'rgba(59,130,246,0.08)' },
        { id: 'r2', label: 'Rack Row B - Database', x: 420, y: 460, w: 300, h: 130, color: 'rgba(239,68,68,0.08)' },
      ],
      vlans: [
        { id: 'v1', name: 'VLAN100', label: 'Web/App Tier', color: '#3b82f6', subnet: '10.0.10.0/24' },
        { id: 'v2', name: 'VLAN200', label: 'DB/Storage Tier', color: '#ef4444', subnet: '10.0.20.0/24' },
      ],
      summary: 'High-availability data center with redundant core routers, top-of-rack switching, and tiered compute/database architecture.',
    };
  }

  function campusTopology() {
    return {
      nodes: [
        { id: 'n1', type: 'cloud', label: 'Internet', x: 400, y: 50, ip: '0.0.0.0/0', vlan: null },
        { id: 'n2', type: 'firewall', label: 'Campus Firewall', x: 400, y: 150, ip: '10.1.0.1', vlan: null },
        { id: 'n3', type: 'router', label: 'Campus Core Router', x: 400, y: 260, ip: '10.1.1.1', vlan: null },
        { id: 'n4', type: 'switch', label: 'Distribution Switch', x: 400, y: 370, ip: '10.1.2.1', vlan: null },
        { id: 'n5', type: 'switch', label: 'Building A Switch', x: 170, y: 480, ip: '10.1.3.1', vlan: 'VLAN10' },
        { id: 'n6', type: 'switch', label: 'Building B Switch', x: 400, y: 480, ip: '10.1.3.2', vlan: 'VLAN20' },
        { id: 'n7', type: 'switch', label: 'Library Switch', x: 630, y: 480, ip: '10.1.3.3', vlan: 'VLAN30' },
        { id: 'n8', type: 'ap', label: 'AP - Classroom 101', x: 100, y: 600, ip: '10.1.4.1', vlan: 'VLAN10' },
        { id: 'n9', type: 'ap', label: 'AP - Classroom 102', x: 240, y: 600, ip: '10.1.4.2', vlan: 'VLAN10' },
        { id: 'n10', type: 'server', label: 'LMS Server', x: 370, y: 600, ip: '10.1.5.1', vlan: 'VLAN20' },
        { id: 'n11', type: 'server', label: 'AD / Auth Server', x: 480, y: 600, ip: '10.1.5.2', vlan: 'VLAN20' },
        { id: 'n12', type: 'ap', label: 'AP - Library', x: 600, y: 600, ip: '10.1.4.3', vlan: 'VLAN30' },
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n2', type: 'wan', label: 'WAN' },
        { id: 'l2', source: 'n2', target: 'n3', type: 'fiber', label: '10Gbps' },
        { id: 'l3', source: 'n3', target: 'n4', type: 'fiber', label: '10Gbps' },
        { id: 'l4', source: 'n4', target: 'n5', type: 'fiber', label: '1Gbps' },
        { id: 'l5', source: 'n4', target: 'n6', type: 'fiber', label: '1Gbps' },
        { id: 'l6', source: 'n4', target: 'n7', type: 'fiber', label: '1Gbps' },
        { id: 'l7', source: 'n5', target: 'n8', type: 'ethernet', label: '' },
        { id: 'l8', source: 'n5', target: 'n9', type: 'ethernet', label: '' },
        { id: 'l9', source: 'n6', target: 'n10', type: 'ethernet', label: '' },
        { id: 'l10', source: 'n6', target: 'n11', type: 'ethernet', label: '' },
        { id: 'l11', source: 'n7', target: 'n12', type: 'ethernet', label: '' },
      ],
      rooms: [
        { id: 'r1', label: 'Building A - Classrooms', x: 60, y: 440, w: 290, h: 220, color: 'rgba(59,130,246,0.08)' },
        { id: 'r2', label: 'Building B - Admin', x: 330, y: 440, w: 190, h: 220, color: 'rgba(16,185,129,0.08)' },
        { id: 'r3', label: 'Library', x: 540, y: 440, w: 190, h: 220, color: 'rgba(245,158,11,0.08)' },
      ],
      vlans: [
        { id: 'v1', name: 'VLAN10', label: 'Student', color: '#3b82f6', subnet: '10.1.10.0/24' },
        { id: 'v2', name: 'VLAN20', label: 'Faculty/Admin', color: '#10b981', subnet: '10.1.20.0/24' },
        { id: 'v3', name: 'VLAN30', label: 'Library/Guest', color: '#f59e0b', subnet: '10.1.30.0/24' },
      ],
      summary: 'Campus network with multi-building distribution, separate VLANs for students, faculty, and library/guest access.',
    };
  }

  function retailTopology() {
    return {
      nodes: [
        { id: 'n1', type: 'cloud', label: 'HQ / Internet', x: 350, y: 60, ip: '0.0.0.0/0', vlan: null },
        { id: 'n2', type: 'router', label: 'Store Router', x: 350, y: 180, ip: '10.5.0.1', vlan: null },
        { id: 'n3', type: 'firewall', label: 'POS Firewall', x: 350, y: 290, ip: '10.5.1.1', vlan: null },
        { id: 'n4', type: 'switch', label: 'Store Switch', x: 350, y: 400, ip: '10.5.2.1', vlan: null },
        { id: 'n5', type: 'pc', label: 'POS Terminal 1', x: 150, y: 520, ip: '10.5.10.1', vlan: 'VLAN10' },
        { id: 'n6', type: 'pc', label: 'POS Terminal 2', x: 280, y: 520, ip: '10.5.10.2', vlan: 'VLAN10' },
        { id: 'n7', type: 'ap', label: 'Guest WiFi AP', x: 400, y: 520, ip: '10.5.20.1', vlan: 'VLAN20' },
        { id: 'n8', type: 'camera', label: 'Security Camera 1', x: 520, y: 520, ip: '10.5.30.1', vlan: 'VLAN30' },
        { id: 'n9', type: 'camera', label: 'Security Camera 2', x: 640, y: 520, ip: '10.5.30.2', vlan: 'VLAN30' },
        { id: 'n10', type: 'server', label: 'Back Office Server', x: 150, y: 650, ip: '10.5.1.10', vlan: 'VLAN10' },
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n2', type: 'wan', label: 'WAN/VPN' },
        { id: 'l2', source: 'n2', target: 'n3', type: 'ethernet', label: '' },
        { id: 'l3', source: 'n3', target: 'n4', type: 'ethernet', label: '1Gbps' },
        { id: 'l4', source: 'n4', target: 'n5', type: 'ethernet', label: '' },
        { id: 'l5', source: 'n4', target: 'n6', type: 'ethernet', label: '' },
        { id: 'l6', source: 'n4', target: 'n7', type: 'ethernet', label: '' },
        { id: 'l7', source: 'n4', target: 'n8', type: 'ethernet', label: '' },
        { id: 'l8', source: 'n4', target: 'n9', type: 'ethernet', label: '' },
        { id: 'l9', source: 'n4', target: 'n10', type: 'ethernet', label: '' },
      ],
      rooms: [
        { id: 'r1', label: 'Sales Floor', x: 100, y: 460, w: 380, h: 250, color: 'rgba(59,130,246,0.08)' },
        { id: 'r2', label: 'Back Office', x: 100, y: 600, w: 140, h: 120, color: 'rgba(16,185,129,0.08)' },
        { id: 'r3', label: 'Security Zone', x: 490, y: 460, w: 230, h: 130, color: 'rgba(239,68,68,0.08)' },
      ],
      vlans: [
        { id: 'v1', name: 'VLAN10', label: 'POS / Business', color: '#3b82f6', subnet: '10.5.10.0/24' },
        { id: 'v2', name: 'VLAN20', label: 'Guest WiFi', color: '#f59e0b', subnet: '10.5.20.0/24' },
        { id: 'v3', name: 'VLAN30', label: 'Security Cameras', color: '#ef4444', subnet: '10.5.30.0/24' },
      ],
      summary: 'Retail store network with PCI-compliant POS segment, guest WiFi isolation, and dedicated security camera VLAN.',
    };
  }

  function hospitalWingTopology() {
    return {
      nodes: [
        { id: 'n1', type: 'cloud', label: 'Internet', x: 400, y: 40, ip: '0.0.0.0/0', vlan: null },
        { id: 'n2', type: 'firewall', label: 'Edge Firewall', x: 400, y: 130, ip: '172.16.0.1', vlan: null },
        { id: 'n3', type: 'router', label: 'Clinical Router', x: 400, y: 220, ip: '172.16.1.1', vlan: null },
        { id: 'n4', type: 'switch', label: 'IDF Switch', x: 400, y: 320, ip: '172.16.2.1', vlan: null },
        { id: 'n5', type: 'ap', label: 'AP - Ward A', x: 180, y: 420, ip: '172.16.10.10', vlan: 'VLAN10' },
        { id: 'n6', type: 'ap', label: 'AP - Ward B', x: 620, y: 420, ip: '172.16.10.11', vlan: 'VLAN10' },
        { id: 'n7', type: 'tablet', label: 'Nurse Tablet 1', x: 120, y: 520, ip: '172.16.10.50', vlan: 'VLAN10' },
        { id: 'n8', type: 'laptop', label: 'Doctor Laptop', x: 280, y: 520, ip: '172.16.10.51', vlan: 'VLAN10' },
        { id: 'n9', type: 'camera', label: 'Hall Camera', x: 520, y: 520, ip: '172.16.30.5', vlan: 'VLAN30' },
        { id: 'n10', type: 'nas', label: 'PACS NAS', x: 660, y: 520, ip: '172.16.20.2', vlan: 'VLAN20' },
      ],
      links: [
        { id: 'l1', source: 'n1', target: 'n2', type: 'wan', label: 'WAN' },
        { id: 'l2', source: 'n2', target: 'n3', type: 'fiber', label: '' },
        { id: 'l3', source: 'n3', target: 'n4', type: 'fiber', label: '' },
        { id: 'l4', source: 'n4', target: 'n5', type: 'ethernet', label: '', poe: 'poe' },
        { id: 'l5', source: 'n4', target: 'n6', type: 'ethernet', label: '', poe: 'poe' },
        { id: 'l6', source: 'n4', target: 'n7', type: 'wifi', label: '' },
        { id: 'l7', source: 'n4', target: 'n8', type: 'wifi', label: '' },
        { id: 'l8', source: 'n4', target: 'n9', type: 'ethernet', label: '', poe: 'poe' },
        { id: 'l9', source: 'n4', target: 'n10', type: 'ethernet', label: '' },
      ],
      rooms: [
        { id: 'r1', label: 'Wing A', x: 80, y: 380, w: 280, h: 220, color: 'rgba(59,130,246,0.08)', zoneType: 'office', securityLevel: 'restricted' },
        { id: 'r2', label: 'Wing B', x: 440, y: 380, w: 280, h: 220, color: 'rgba(16,185,129,0.08)', zoneType: 'office', securityLevel: 'restricted' },
      ],
      vlans: [
        { id: 'v1', name: 'VLAN10', label: 'Clinical WiFi', color: '#3b82f6', subnet: '172.16.10.0/24' },
        { id: 'v2', name: 'VLAN20', label: 'Imaging / PACS', color: '#8b5cf6', subnet: '172.16.20.0/24' },
        { id: 'v3', name: 'VLAN30', label: 'Physical Security', color: '#ef4444', subnet: '172.16.30.0/24' },
      ],
      summary: 'Hospital wing with segmented clinical WiFi, imaging VLAN, and camera security zone.',
    };
  }

  // Templates
  export const TEMPLATES = [
    {
      id: 'office',
      name: 'Corporate Office',
      description: 'Multi-department office with VLANs, firewall, and WiFi',
      icon: '🏢',
      prompt: 'Corporate office with 3 departments, firewall, core switch, WiFi access points, file server, and 10 workstations',
      data: officeTopology(),
    },
    {
      id: 'home',
      name: 'Home Network',
      description: 'Residential network with WiFi mesh and NAS',
      icon: '🏠',
      prompt: 'Home network with dual WiFi access points, NAS storage, and IP cameras',
      data: homeTopology(),
    },
    {
      id: 'datacenter',
      name: 'Data Center',
      description: 'High-availability data center with redundant paths',
      icon: '🗄️',
      prompt: 'Data center with redundant core routers, top-of-rack switches, web servers, and database tier',
      data: dataCenterTopology(),
    },
    {
      id: 'campus',
      name: 'Campus / School',
      description: 'Multi-building campus with student/faculty VLANs',
      icon: '🎓',
      prompt: 'University campus with 3 buildings, student and faculty VLANs, LMS server, and library WiFi',
      data: campusTopology(),
    },
    {
      id: 'retail',
      name: 'Retail Store',
      description: 'PCI-compliant POS network with guest WiFi',
      icon: '🛒',
      prompt: 'Retail store with POS terminals, guest WiFi, security cameras, and back office server',
      data: retailTopology(),
    },
    {
      id: 'hospital',
      name: 'Hospital Wing',
      description: 'Clinical WiFi, imaging VLAN, and secure camera segment',
      icon: '🏥',
      prompt: 'Hospital wing with nurse WiFi, PACS storage, and security cameras on isolated VLAN',
      data: hospitalWingTopology(),
    },
  ];

  export function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  export function getTopologyStats(nodes, links, vlans) {
    const typeCounts = {};
    nodes.forEach(n => {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    });
    return {
      totalNodes: nodes.length,
      totalLinks: links.length,
      totalVlans: vlans.length,
      typeCounts,
    };
  }
