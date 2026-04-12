# TopologAi — Ultimate AI-Assisted Network Topology Designer
## Prompt v3 — Smart Network Intelligence Edition

---

Build a polished, modern, responsive frontend-only web application called **TopologAi**.

==================================================
PROJECT CONCEPT
==================================================

TopologAi is a smart, AI-assisted network topology designer with physical
environment awareness and deterministic network intelligence. It is NOT just
a diagram tool — it is a living network simulation canvas.

The user describes a physical space in natural language OR manually builds a
topology. The system generates a suggested network layout, then continuously
analyzes it using a deterministic rules engine. Every device, wall, barrier,
zone, and link is network-aware. Moving a laptop away from an AP makes it go
"Slow". Drawing a concrete wall between AP and clients immediately weakens
signal. Adding 50 WiFi devices to one AP triggers congestion warnings.

This app combines FIVE disciplines:
1. Natural-language AI-assisted network design
2. Visual network diagram editing (drag, connect, label)
3. Physical environment / floor plan editing (walls, rooms, barriers)
4. Deterministic network simulation (coverage, capacity, resilience, security)
5. Smart diagnostics with actionable fix suggestions

**IMPORTANT CONSTRAINTS:**
- Frontend only — no backend, no server
- No real AI — use mock AI for NLP generation, but the rules engine is REAL
- No authentication or database
- All state in React + Zustand
- The deterministic smart rules engine runs locally on every canvas change
- Must feel like a production network design tool, not a toy
- Must be ready for future real API integration

==================================================
VISUAL IDENTITY & DESIGN LANGUAGE
==================================================

**Aesthetic Direction:** Technical Precision — premium dark-mode network
engineering tool. Think Figma × Cisco × Bloomberg terminal. "Control room"
feel — information-dense but never cluttered. Accent colors like indicator
lights on real networking hardware.

**Theme:** Dark mode PRIMARY (light mode optional toggle)

**Color Palette:**
  Background:       #0B0F19 (deep midnight)
  Surface:          #111827 (panel bg)
  Surface raised:   #1F2937 (cards, modals)
  Border:           #374151
  Text primary:     #F1F5F9
  Text secondary:   #94A3B8
  Text muted:       #64748B
  Accent primary:   #06B6D4 (electric cyan)
  Accent warm:      #F59E0B (amber — warnings)
  Success:          #10B981 (green — healthy)
  Error:            #EF4444 (red — critical)
  Fiber:            #8B5CF6 (violet)
  WiFi:             #06B6D4 (cyan dashed)
  Ethernet:         #94A3B8 (gray solid)
  WAN:              #F97316 (orange)
  VPN:              #A855F7 (purple dashed)
  Heatmap strong:   #06B6D4
  Heatmap weak:     #EF4444
  Heatmap dead:     #374151

**Typography:**
  Logo/monospace:   "JetBrains Mono" or "IBM Plex Mono"
  Headings:         "DM Sans" or "Outfit"
  Body:             "DM Sans" 13–14px
  Data/IPs/stats:   "JetBrains Mono" 11–12px
  Section headers:  11px uppercase, letter-spacing: 0.08em, #64748B

**Canvas:**
  Background:       #0D1117 with dot grid (#1E293B, 20px, 1.5px radius)
  Walls:            #475569 fill + #64748B stroke + crosshatch SVG pattern
  Selection:        #06B6D4 border + glow (0 0 12px rgba(6,182,212,0.3))
  Node cards:       #1F2937, 1px #374151 border, 8px radius
  Barriers:         Material-dependent color tint (concrete=dark, glass=light, metal=blue-gray)

**Micro-animations:**
  - Nodes scale 1.03× on drag, spring ease on drop
  - Connections stroke-dasharray animate on creation
  - WiFi dashes flow with animated dash-offset
  - Score bars fill with spring animation
  - Heatmap fades in 400ms
  - Selected node: slow pulsing glow (2s infinite)
  - Warning highlight: 3× pulse on target node
  - Status dots: breathing animation for "Online"
  - Modal backdrop: backdrop-filter: blur(8px)
  - Device state badges animate color transitions smoothly
  - Packet dots travel along connections during simulation

==================================================
SMART NETWORK INTELLIGENCE ENGINE (CORE DIFFERENTIATOR)
==================================================

This is the heart of TopologAi. Unlike every other topology tool that is
just a drawing board, TopologAi UNDERSTANDS the network it displays.

The engine runs deterministically on every canvas change (debounced 200ms).
No AI API needed. Pure local computation.

### 1. Smart Zones (Network-Aware Rooms)

Rooms are not just visual rectangles. Each room/zone has:

| Field | Example | Purpose |
|---|---|---|
| zoneType | office, server_room, guest_area, outdoor, storage, restricted, iot_area | Zone-specific rules |
| floor | 1, 2, basement | Multi-floor signal penalty |
| environment | open, dense, industrial, residential | Wireless noise factor |
| maxUsers | 25 | Overcrowding detection |
| requiredVlan | VLAN10 | VLAN compliance checks |
| allowedDeviceTypes | server,nas,switch,pdu | Placement compliance |
| securityLevel | public, staff, restricted, critical | Access/exposure rules |
| defaultWallMaterial | drywall, glass, concrete, metal | Signal attenuation |
| wallThickness | thin, medium, thick | Multiplied attenuation |
| noiseLevel | low, medium, high | WiFi quality reduction |

**Smart behaviors:**
- Devices inside a guest zone auto-recommend guest VLAN
- Servers in a public zone → high-severity security finding
- APs in dense zones → smaller practical coverage
- Cameras outside security zone with no NAS path → warning
- Printers in server rooms → warning unless explicitly allowed
- Zone with no AP/router and no wired uplink → "Coverage Gap"
- Devices exceeding maxUsers → congestion warning

### 2. Coverage Sources (AP/Router Intelligence)

Every router/AP has wireless intelligence fields:

| Field | Example | Purpose |
|---|---|---|
| wifiEnabled | true | Toggles wireless coverage |
| coverageRadius | 180 | Canvas units for usable signal |
| maxRadius | 240 | Edge of any signal |
| wifiBand | 2.4GHz, 5GHz, 6GHz, dual, tri | Range/speed behavior |
| txPower | low, medium, high | Adjusts radius |
| channel | 1, 6, 11, auto | Co-channel interference |
| capacityClients | 30 | Overload detection |
| backhaulType | ethernet, wifi_mesh, powerline | Upstream bottleneck check |
| ssid | Corporate, Guest | VLAN/security mapping |
| supportedVlans | VLAN10, VLAN30 | Trunk validation |

**Coverage calculation:**
```
base = 100 - (distance / maxRadius) × 100
score = base - barrierLoss - roomWallLoss - floorLoss - noiseLoss
        - loadPenalty - interferencePenalty
score = clamp(score, 0, 100)
```

**Signal states:**
| Score | State | Badge |
|---|---|---|
| 80–100 | Healthy | ● Excellent (green) |
| 60–79 | Healthy | ● Good (green) |
| 40–59 | Warning | ● Weak (amber) |
| 20–39 | Warning | ● Slow (red-amber) |
| 0–19 | Critical | ● No Network (red) |

### 3. Barrier System (Not Just Walls)

Separate from rooms. A barrier can be a wall, shelf, elevator shaft,
glass partition, metal rack, fire door, or custom object.

| Barrier Type | Signal Loss | Visual |
|---|---|---|
| drywall | low | Light gray, thin |
| glass | low-medium | Light blue, transparent feel |
| wood | low-medium | Brown tint |
| brick | medium | Terracotta/dark red |
| concrete | high | Dark gray, hatched |
| metal | very high | Blue-gray, solid |
| water | very high | Blue tint |
| rf_shield | full block | Dark with warning stripes |
| custom | user-defined | User color |

**Barrier fields:**
- barrierType, thickness, attenuationDb (advanced override)
- blocksWifi (hard block for shielded spaces)
- blocksCablePath (for cable routing validation)
- label, shape (line or rectangle)

**Smart behaviors:**
- AP-client line crosses barrier → reduce signal by attenuation
- Multiple barriers → stack attenuation
- rf_shield → "No network" unless AP is inside the shield
- Cable link crosses barrier with blocksCablePath → routing warning
- Most clients behind thick concrete are slow → recommend moving AP

### 4. Wall Attenuation Matrix

Room borders act as implicit barriers:

| Material | Thin | Medium | Thick |
|---|---:|---:|---:|
| Drywall | 3 dB | 5 dB | 8 dB |
| Glass | 4 dB | 7 dB | 10 dB |
| Brick | 8 dB | 12 dB | 18 dB |
| Concrete | 12 dB | 20 dB | 30 dB |
| Metal | 20 dB | 35 dB | 50 dB |

### 5. Wireless Client Intelligence

Wireless-capable devices: laptop, tablet, phone, printer, smarttv,
iot, camera (if wifi mode), pc (if wifi adapter enabled).

Each wireless client has:
- connectionMode: wifi | wired | auto
- preferredSsid: maps to AP/SSID
- requiredBandwidthMbps: drives bottleneck warnings
- mobility: fixed | mobile (roaming coverage needed)
- criticality: low | normal | high | critical
- networkState: CALCULATED → healthy, weak_signal, slow_network,
  no_network, isolated, blocked_by_policy, power_missing, at_risk

**Smart behaviors:**
- Laptop with no wire and no AP coverage → "No Network" badge
- Tablet in restricted zone on guest SSID that can reach server VLAN → security warning
- WiFi printer far from AP → "slow printing / unreliable"
- Camera requiring 8Mbps on weak WiFi → "video stream unstable"
- Smart TV needing high bandwidth → recommend wired Ethernet

### 6. Wired Link Intelligence

| Field | Example | Purpose |
|---|---|---|
| bandwidthMbps | 1000 | Machine-readable capacity |
| cableLengthM | 80 | Copper/fiber limit checks |
| poe | none, poe, poe+, poe++ | Power over Ethernet |
| latencyMs | 1 | Simulation metric |
| utilizationPercent | 65 | Load tracking |
| redundantGroup | uplink-a | Failover checks |
| trunkVlans | VLAN10,VLAN20 | VLAN transport validation |
| mediaType | cat5e, cat6, cat6a, fiber_sm, fiber_mm | Media compatibility |

**Smart behaviors:**
- Ethernet > 100m → "copper cable too long"
- AP on 100Mbps backhaul serving many clients → "AP backhaul bottleneck"
- Server expected 2Gbps but has 1Gbps uplink → "undersized uplink"
- Fiber link to non-fiber endpoint → "media mismatch"
- Guest VLAN missing from AP trunk → "guest traffic cannot reach gateway"
- PoE camera on non-PoE switch → "device may not power on"

### 7. Device Capability Profiles

Default rules per device type:

| Device | Smart Defaults |
|---|---|
| Router | Gateway, DHCP, optional WiFi, routes VLANs |
| Firewall | WAN edge, policy boundary, segmentation |
| Switch | Wired aggregation, VLAN trunk/access, optional PoE |
| Access Point | WiFi source, SSID/VLAN mapping, client capacity |
| Server | High bandwidth, should be in server/restricted zone |
| NAS | Storage target, avoid guest/public zone |
| Camera | Continuous stream, needs PoE, security VLAN |
| Printer | Shared resource, not on guest VLAN |
| IoT Gateway | Isolated from corporate/server VLANs |
| PDU/UPS | Power dependency source |
| Load Balancer | Client side + server side connections |
| Cloud/ISP | External, should connect through firewall first |

### 8. Network State Model

Every device gets a calculated smartState:

| State | Meaning | Badge Color |
|---|---|---|
| healthy | Valid path + enough quality | Green |
| weak_signal | WiFi usable but poor | Amber |
| slow_network | Signal/backhaul/cable/congestion limits | Orange |
| no_network | No usable path | Red |
| isolated | Connected but no gateway/VLAN path | Purple |
| blocked_by_policy | Physical exists but policy blocks | Gray |
| power_missing | Needs PoE/PDU but none available | Yellow-red |
| at_risk | Works now but redundancy is risky | Amber-dashed |

Each state includes `reasons[]` and `suggestions[]`:
```json
{
  "deviceId": "n13",
  "smartState": "slow_network",
  "quality": 34,
  "reasons": [
    "Laptop is 210 units from AP-Lobby.",
    "Signal crosses 1 thick concrete room border (-20 dB).",
    "AP-Lobby serves 34 clients, above capacity 30."
  ],
  "suggestions": [
    "Move Laptop closer to AP-Lobby.",
    "Add an AP inside Office Area B.",
    "Switch this device to wired Ethernet."
  ]
}
```

### 9. Smart Rules Catalog

These run locally on every topology change:

**Coverage Rules:**
- WiFi client with no wire + no reachable AP → no_network
- Signal score < 40 → slow_network
- Signal score < 20 → no_network
- Client in room with thick concrete border + AP outside → strong penalty
- AP capacity exceeded → mark lowest-signal clients congested first
- Two nearby APs same channel → co-channel interference warning
- Zone with many wireless clients but no AP → "coverage gap"

**Barrier Rules:**
- AP-client line crosses concrete/metal/water/rf_shield → reduce signal
- rf_shield → require AP inside same shielded area
- Wired link crosses cable-blocking barrier → routing warning
- Most clients behind one barrier slow → recommend AP relocation

**VLAN & Zone Rules:**
- Device VLAN ≠ zone requiredVlan → compliance warning
- Guest VLAN reaches server VLAN without firewall → security alert
- Camera not on security VLAN → warning
- IoT on corporate VLAN → warning
- Server in public zone → HIGH severity
- No firewall between Cloud/ISP and internal → CRITICAL

**Capacity Rules:**
- Sum client bandwidth through each AP/switch/router/uplink
- Load > 70% → warning
- Load > 90% → bottleneck
- AP backhaul slower than wireless capacity → bottleneck
- WAN link slower than total critical demand → warning

**Cable & Power Rules:**
- Ethernet > 100m → warning
- PoE device on non-PoE switch → power_missing
- Critical device without UPS/PDU → warning
- Patch panel should not count as active network hop

**Resilience Rules:**
- Single point of failure detection
- All APs depend on one switch → "wireless outage if switch fails"
- Firewall is single device → suggest HA pair for enterprise
- Server has only one uplink + marked critical → suggest redundant
- Only one WAN path → suggest backup WAN

### 10. Failure Impact Mode (THE KILLER FEATURE)

Click any device or link and press "Simulate Failure" (or right-click → "What if this fails?"):

- The engine temporarily removes that device/link from the graph
- Recalculates all dependent devices' states
- Shows a red overlay on every device that would go offline/degrade
- Right panel shows impact summary:
    "If Switch-A fails: 8 devices lose connectivity,
     3 APs go offline, coverage drops from 85% to 12%"
- Affected devices pulse red on canvas
- A "blast radius" circle animation radiates from the failed device
- Exit impact mode with Escape or "End Simulation"

### 11. AP Placement Helper

When a zone shows "coverage gap" or many devices are "weak/slow":

- Toggle "AP Placement Advisor" in toolbar
- Ghost circles appear on the canvas showing recommended AP positions
- Each ghost shows estimated improvement: "+23% coverage if AP placed here"
- User can click a ghost to confirm and place an actual AP there
- Recommendations are based on: uncovered device positions, barrier
  geometry, existing AP positions, zone boundaries

### 12. Zone Compliance Mode

Toggle "Compliance View" in toolbar:

- Canvas overlays colored tints per zone security level:
    Public = transparent with green border
    Staff = light blue tint
    Restricted = amber tint
    Critical = red tint
- Devices in wrong VLAN or wrong zone get a flashing violation badge
- Right panel lists all compliance violations with "Fix" suggestions
- "Fix All" button applies all auto-fixable violations

### 13. Bottleneck Flow Visualization

Toggle "Traffic Flow" in toolbar:

- Animated dots flow along connections
- Dot speed and density proportional to estimated traffic load
- Overloaded links pulse red and thicken
- Underutilized links dim
- Right panel shows top 5 bottleneck links ranked by utilization %

==================================================
UNIQUE UI FEATURES
==================================================

### A) Signal Heatmap Overlay
- Layered radial gradients per AP on canvas
- Colors: cyan (strong) → blue → yellow → orange → red (weak)
- Walls visually attenuate (reduce gradient on far side via ray-cast)
- Toggle in toolbar with thermal icon
- Canvas dims slightly when active
- **Heatmap Legend** in bottom-left: -30dBm (cyan) to -90dBm (red) scale
- **Live update**: heatmap recalculates while dragging AP or barrier

### B) AI Confidence Score
- Mock confidence badge (e.g., "88% Confident")
- Breakdown: Coverage: High | Cost: Low | Redundancy: Medium
- Animated count-up from 0% on generation
- Color: >80% green, 50-80% amber, <50% red

### C) Topology Score Card (5 Categories)
- Overall score: large number with circular progress ring
- Categories: Coverage, Capacity, Security, Resilience, Power
- Each 0–100 with animated bar (green >70, amber 40-70, red <40)
- **Score Delta**: "+5" green / "-3" red on change (fades after 3s)
- **Score Trend Sparkline**: last 10 edits for overall score
- Hover shows improvement suggestion tooltip

### D) Device Status Simulation
- Each device: Online, Idle, Warning, Offline with colored dot
- Dot on node card (green/amber/yellow/red)
- "Simulate" triggers randomized changes with stagger
- **Packet Animation**: tiny dots travel along active connections
- **Uptime Counter**: mock "99.7% uptime" in inspector

### E) Connection Type Labels & Visuals
- Ethernet: solid gray 2px
- WiFi: dashed cyan 2px with animated dash flow
- Fiber: thick violet 3px with glow
- WAN: solid orange 2px
- VPN: dashed purple 2px
- Label on hover at midpoint: "Ethernet 1Gbps" in monospace pill
- **Bandwidth Indicator**: thickness scales with bandwidth
- **Wall crossing**: yellow ⚠ at crossing point

### F) Smart Warnings Panel (Replaces Simple Warnings)
- Each warning has:
    Severity icon (🔴 Error / 🟡 Warning / 🔵 Info)
    Message text with specific device/link names
    [Highlight] button → pulse the relevant node
    [Auto Fix] button → applies suggested fix
    [Why?] button → shows calculation breakdown
- Toolbar shows warning count badge
- Warnings update reactively on every change
- Empty state: "No issues detected ✓" in green

### G) Export Options (UI only)
- PNG, SVG, JSON (+ Copy to Clipboard), PDF Report,
  Cisco .pkt, Network Config Script (mock IOS/MikroTik)
- Demo toast on click

### H) Mini-Map
- 160×120px, bottom-right, collapsible
- Scaled nodes (colored dots), connections, walls
- Cyan viewport rectangle (draggable to navigate)
- Auto-hides when canvas fits in viewport

### I) Topology Templates (8)
- Home Network | Small Office | Enterprise Floor | School Classroom
- Data Center | Retail Store | Hospital Wing | Warehouse/IoT
- Each: SVG preview, device count, room count, complexity badge
- Hover shows larger preview tooltip
- Loading a template applies with generation animation

### J) Undo / Redo + History Panel
- Full history stack (Ctrl+Z / Ctrl+Y)
- History panel: last 15 actions as scrollable list
- Each action clickable to revert
- Timestamps (relative: "2m ago")

### K) "Why Is This Slow?" Hover Tooltips
- Hover over any device badge (Slow / Weak / No Net / etc.)
- Tooltip shows exact reasons:
    "Signal: 34/100
     - 210 units from AP-Lobby
     - 1 thick concrete wall (-20 dB)
     - AP at 113% capacity"
- Plus suggestions inline

### L) Network Path Tracer
- Select 2 devices → "Trace Route" button appears
- Animated dashed cyan line from source to destination
- Right panel shows path hops:
    Device A → Switch 1 → Router → Switch 2 → Device B
- Mock latency per hop ("<1ms", "2ms")
- Total path latency and hop count

### M) Device Port Visualization
- When switch/router selected, inspector shows port panel
- Visual row of port rectangles (8/16/24/48)
- Green = connected | Dark = unused | Red = error
- Hover shows connected device name
- PoE indicator dot on PoE-capable ports

### N) Cable Length Estimator
- Per-connection length based on pixel distance (1px = 0.5ft)
- Over 100m (ethernet) → red warning on connection
- Total cable summary in stats bar
- Scale is configurable

### O) VLAN Zone Overlays
- Drawn as colored semi-transparent rectangles on canvas
- 4 preset colors (blue, green, purple, orange) at 10% opacity
- Dashed border matching zone color
- Label: "VLAN 10 — Staff" in top-left
- Devices inside get subtle colored accent border
- Zones behind devices (lower z-index)

### P) Snap & Alignment Guides
- Alignment guides (thin cyan lines) on node drag
- Magnetic snap within 8px of another node's axis
- "Distribute Evenly" for 3+ selected nodes

### Q) Multi-Select & Bulk Actions
- Shift+Click or drag selection rectangle
- Floating action bar: Move | Delete | Group | Align

### R) Command Palette (Ctrl+K)
- Search: devices, actions, templates, rooms
- Keyboard navigation, instant execution/selection

### S) Onboarding Tour (First-Time)
- 5-step tooltip tour:
  1. "Describe your space" → prompt area
  2. "Or drag devices" → toolbox
  3. "Draw walls and barriers" → canvas
  4. "Review intelligence and scores" → right sidebar
  5. "Simulate failures" → toolbar
- "Skip Tour" on each step

### T) Network Statistics Bar
- Bottom of canvas, 32px, monospace:
  "Devices: 20 | Links: 24 | APs: 3 | Rooms: 3 | Walls: 8 |
   Online: 18 | Warnings: 3 | Zoom: 100%"

### U) Power Dependency Visualization (NEW)
- Toggle "Power View" in toolbar
- Shows which devices depend on which PDU/UPS
- Dependency lines drawn in yellow-orange
- If PDU/UPS removed → show cascade of power_missing states
- Critical devices without UPS highlighted with warning icon

### V) Co-Channel Interference Visualization (NEW)
- When heatmap is active and 2+ APs share the same channel:
- Overlapping coverage zones show interference pattern (striped/cross-hatched overlay)
- Tooltip: "AP-1 and AP-3 both on Channel 6 — co-channel interference"
- Suggestion: "Change AP-3 to Channel 11"

### W) Bandwidth Utilization Heatmap (NEW)
- Second heatmap mode: instead of WiFi signal, show link utilization
- Links colored: green (<50%) → yellow (50-70%) → orange (70-90%) → red (>90%)
- Toggle between "Signal Heatmap" and "Bandwidth Heatmap" in toolbar

### X) Smart Design Brief Export (NEW)
- Export modal includes "Design Brief" option
- Generates a structured summary (displayed in modal, copyable):
    Project name, device count, room count
    Coverage score, capacity score, security score, resilience score
    Top 5 issues found
    Top 5 fix recommendations
    Bill of materials (device list with quantities)
- This is pure frontend text generation, no AI needed

==================================================
MAIN LAYOUT
==================================================

Full 3-column dark dashboard:

**LEFT SIDEBAR** (280px, collapsible, resizable)
  - Project header + logo
  - Workflow progress bar (steps)
  - Natural language prompt area
  - Example prompt chips
  - Templates button
  - Network Elements toolbox (18 device types)
  - Environment & Barrier toolbox
  - Collapsible sections

**CENTER WORKSPACE** (flex: 1)
  - Canvas toolbar (tools, toggles, modes)
  - Interactive canvas (SVG or div-based)
  - Stats bar (bottom)
  - Mini-map (bottom-right)

**RIGHT SIDEBAR** (320px, collapsible, resizable)
  - Network Intelligence panel (replaces simple AI Analysis)
      - Overall Score with ring
      - Score breakdown (5 categories)
      - Score trend sparkline
  - Smart Findings list (warnings/errors/info with Fix buttons)
  - AI Recommendations (mock, with confidence)
  - Design Explanation
  - Selected Object Inspector (device/wall/barrier/zone)
  - History panel (collapsible)

Both sidebars collapse for full-canvas mode.

==================================================
LEFT SIDEBAR — DETAILED SPEC
==================================================

### A) Project Header
- SVG logo: node-graph + pulse wave in cyan
- "TopologAi" in monospace, "Ai" in cyan
- Subtitle: "Smart Network Topology Designer"
- "New Project" icon button
- Editable project name field

### B) Workflow Progress Bar
- 9 steps as connected dots
- Current: cyan filled with glow
- Completed: solid | Future: outlined
- Steps: Describe → Generate → Place Devices → Draw Walls →
  Add Barriers → Set Zones → Review Intelligence → Trace & Simulate → Export

### C) Prompt Area
- Dark textarea, 5 rows
- Placeholder: "Describe your space, e.g.: 3 rooms — server room,
  open office with 15 workstations, meeting room. Thick concrete walls.
  Need full WiFi coverage and camera monitoring."
- "Generate Topology" primary button (cyan)
- "Load Example" secondary
- "⌘+Enter to generate" hint
- Character count

### D) Example Prompt Chips
- Home Network | Small Office | Classroom | Multi-floor
- Server Room | Retail Store | Hospital Wing | Warehouse IoT

### E) Templates Button
- "Browse Templates" with grid icon + "8 templates" badge

### F) Network Elements Toolbox
- Header: "NETWORK ELEMENTS" with search/filter input
- 2-column grid, 18 device types:
    Router | Switch | Access Point | Firewall
    Cloud/ISP | Server | NAS | Load Balancer
    PC | Laptop | Printer | IP Camera
    VoIP Phone | Tablet | IoT Gateway | Smart TV
    PDU/UPS | Patch Panel
- Each: custom SVG icon + label + drag handle dots
- Drag onto canvas OR click to activate placement mode
- Hover: border accent, slight lift

### G) Environment & Barrier Toolbox
- Header: "ENVIRONMENT"
- Tools:
    🧱 Wall / Barrier — "Draw walls and barriers" (PRIMARY, accent border)
    🏷️ Room / Zone — "Create smart zones"
    🚪 Door / Opening — "Mark openings in walls"
    🪟 Window / Glass — "Glass partitions"
    📦 Obstacle — "Furniture, shelves, racks"
    🎨 VLAN Zone — "Network segmentation overlay"
    📡 Noise Source — "Microwaves, machinery, interference" (NEW)
    ⚡ Power Zone — "UPS/PDU coverage area" (NEW)
    🔌 Cable Conduit — "Cable routing path" (NEW)
- Active tool: filled accent background

==================================================
CENTER WORKSPACE — DETAILED SPEC
==================================================

### Canvas Toolbar

**Left group:**
  Undo (↩) | Redo (↪) | Divider
  Select | Pan | Connect | Divider
  Zoom −/level%/+ | Fit | Reset | Divider
  Snap Grid toggle

**Center/Mode group:**
  Signal Heatmap toggle (thermal icon, glows when active)
  Bandwidth Heatmap toggle
  Traffic Flow toggle
  Compliance View toggle
  AP Placement Advisor toggle

**Right group:**
  Simulate Failure (⚡ icon)
  Simulate Status (play icon)
  Warning Count badge (bell + red count)
  Divider
  Export (download icon)
  Collapse Sidebars (⟨⟩)

### Canvas Interactions

- All standard: click-select, drag-move, scroll-zoom, pan, multi-select
- Right-click context menus (node, wall, barrier, canvas)
- Double-click label to edit inline
- Connection drawing: connect tool → click source → drag to target
- Wall/barrier drawing: click tool → click+drag on canvas
- Keyboard shortcuts (see section below)

### Network Nodes on Canvas

- Rounded rectangle (140×60px) with icon + label
- **Smart state badge** (NEW — most important visual):
    Top-right corner: colored badge showing computed state
    ● Excellent (green) | ● Good (green-dim) | ● Weak (amber) |
    ● Slow (orange) | ● No Net (red) | ● Isolated (purple) |
    ● PoE! (yellow) | ● At Risk (amber-dashed)
- Badge updates LIVE as user moves devices or draws walls
- Hover badge → "Why?" tooltip with reasons + suggestions
- Selected: cyan border + glow
- Port indicators along bottom edge (switches/routers)

### Connections on Canvas

Same as v2 spec (typed lines with bandwidth scaling, wall-crossing
warnings, packet animation, hover labels) PLUS:
- Utilization color in bandwidth heatmap mode
- PoE indicator icon on PoE-carrying links
- Redundancy indicator: links in same redundantGroup shown with
  parallel offset and "redundant" badge

### Walls, Barriers, Rooms

Full spec from v2 (creation, handles, rotation, resize, grid snap,
material properties, inspector) PLUS:
- Barriers visually differ by material (concrete = dark hatched,
  glass = light blue semi-transparent, metal = blue-gray solid,
  rf_shield = dark + warning stripes)
- Room detection from closed wall shapes → auto-name prompt
- Room borders inherit wall material attenuation

### Empty State
- Animated SVG network illustration
- "Design Your Network" title
- Two CTAs: "Describe Environment" | "Browse Templates"
- Pulsing dashed canvas border

### Loading State
- 2.5s mock delay with streaming text + progress bar
- Cancel button

### Generated State
- Staggered node fade-in, connection draw-in, wall slide-in
- Smart badges appear last after engine calculates
- Score bars animate, confidence counts up

==================================================
RIGHT SIDEBAR — DETAILED SPEC
==================================================

### A) Network Intelligence Panel (UPGRADED)
- Header: "NETWORK INTELLIGENCE" with brain/circuit icon
- Overall Score: large number in circular ring
- 5 category bars: Coverage, Capacity, Security, Resilience, Power
- Score deltas on changes
- Sparkline for trend
- Each bar tooltip: improvement suggestion

### B) Smart Findings List
- Header: "FINDINGS" with count badge
- Sortable by severity
- Each finding:
    Severity icon + message + device name highlighted
    [Highlight] → pulse node
    [Auto Fix] → apply suggestion
    [Why?] → show calculation tooltip
- Examples:
    🔴 "Laptop-3 has no network: outside WiFi coverage, no wired link"
    🔴 "App Server has no redundant uplink — single point of failure"
    🟡 "AP-Lobby at 113% capacity: 34 clients vs 30 max"
    🟡 "Guest WiFi AP trunk missing VLAN30"
    🟡 "IP Camera-1 requires PoE but Store Switch has no PoE"
    🔵 "Office Area B: consider adding AP for 7 weak devices"
    🔵 "No VLAN segmentation — all devices on flat network"

### C) AI Recommendations (mock)
- Confidence badge, structured recommendations list
- Design explanation paragraph with left accent border

### D) Inspector
- Device: all fields + smart state summary with reasons + port panel
- Wall/Barrier: material, thickness, attenuation dB, blocks wifi/cable
- Room/Zone: zone type, security level, VLAN, wall material, max users
- VLAN Zone: name, ID, color, devices inside

### E) History Panel
- Last 15 actions, clickable to revert

==================================================
MODALS
==================================================

- Templates (8 cards, 2-col grid, hover preview)
- Export (7 options including Design Brief)
- New Project confirmation
- Command Palette (Ctrl+K)
- Keyboard Shortcuts Reference ("?" key)
- Onboarding Tour (5-step)
- Failure Impact Results (summary modal after simulation)

==================================================
KEYBOARD SHORTCUTS
==================================================

Movement: Arrow (16px), Shift+Arrow (1px), Del, Escape
Tools: V(select), H(pan), C(connect), W(wall), L(label), Z(zone), B(barrier)
Actions: Ctrl+Z(undo), Ctrl+Y(redo), Ctrl+D(duplicate), Ctrl+A(select all),
         Ctrl+K(command palette), Ctrl+E(export), Ctrl+Enter(generate),
         Ctrl+H(heatmap), F(failure sim), ?(shortcuts)

==================================================
STATE MANAGEMENT (Zustand)
==================================================

```
canvasState:
  nodes: SmartNode[]         // + smart fields (connectionMode, criticality, etc.)
  walls: Wall[]              // + material, thickness, attenuation
  barriers: Barrier[]        // NEW — separate from walls
  connections: Connection[]  // + bandwidth, poe, trunkVlans, utilization
  rooms: SmartRoom[]         // + zoneType, securityLevel, requiredVlan, etc.
  vlanZones: VLANZone[]
  noiseSources: NoiseSource[] // NEW

smartState:                  // Computed by engine on every change
  deviceStates: Map<string, DeviceSmartState>  // state + reasons + suggestions
  coverageMap: CoverageData[]                   // per-grid-point signal scores
  bottlenecks: BottleneckInfo[]
  complianceViolations: Violation[]
  singlePointsOfFailure: SPOFInfo[]
  overallScores: {coverage, capacity, security, resilience, power}
  scoreHistory: number[]
  findings: Finding[]        // sorted by severity

uiState:
  selectedTool, selectedObjectIds[], zoomLevel, panOffset
  showHeatmap, heatmapMode ('signal' | 'bandwidth')
  showTrafficFlow, showComplianceView, showPowerView
  showAPAdvisor, failureSimTarget, isSimulatingFailure
  gridSnap, sidebarsCollapsed

historyState:
  past, future, actionLog
```

==================================================
MOCK DATA
==================================================

(Same detailed mock as v2 — 20 devices, 3 rooms, concrete walls —
but now with full smart fields populated so the engine produces
real findings on load)

After generation, the engine should immediately produce:
- 3-4 warnings (AP capacity, missing redundancy, coverage gap, no VLAN)
- Device badges: most green, 2-3 amber/orange, 1 red if applicable
- Scores: Coverage 82, Capacity 65, Security 55, Resilience 48, Power 72
- Overall: ~64

==================================================
DELIVERABLE CHECKLIST
==================================================

**Smart Engine (THE DIFFERENTIATOR):**
☐ Deterministic signal calculation with distance + barriers + walls
☐ Live device state badges (Excellent/Good/Weak/Slow/No Net/Isolated)
☐ "Why is this slow?" hover tooltips with exact reasons
☐ Auto-fix suggestions on findings
☐ Failure Impact Mode (click device → see blast radius)
☐ AP Placement Advisor (ghost circles with improvement %)
☐ Zone Compliance Mode (VLAN/security violations highlighted)
☐ Traffic Flow / Bottleneck visualization
☐ Co-channel interference detection
☐ Cable length validation (>100m warning)
☐ PoE dependency checking
☐ Single point of failure detection
☐ Capacity/overload scoring per AP and link
☐ Power dependency visualization
☐ Smart Design Brief export

**Canvas & Interaction:**
☐ All standard canvas features (pan, zoom, select, drag, connect, etc.)
☐ Signal heatmap with wall attenuation
☐ Bandwidth utilization heatmap
☐ Barrier system (9 material types with visual differences)
☐ Smart zones (not just rooms — network-aware)
☐ VLAN zone overlays
☐ Walls with material/thickness affecting signal
☐ Network path tracer
☐ Packet flow animation
☐ Port visualization (switch/router)
☐ Mini-map, stats bar, alignment guides
☐ Multi-select, undo/redo, context menus

**UI Chrome:**
☐ Dark theme, custom fonts, micro-animations
☐ 3-column layout with collapsible sidebars
☐ 18 device types in toolbox
☐ 9 environment tool types
☐ Templates (8), Export (7 options), Command Palette
☐ Onboarding tour, keyboard shortcuts

This is the smartest network topology tool on the web. Make it legendary.
