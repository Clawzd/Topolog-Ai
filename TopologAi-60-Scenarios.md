# TopologAi — 50 Network Simulation Scenarios
## Task List for Deterministic Network Intelligence Engine

Every scenario below describes a real network situation.
For each one, the engine must:
1. DETECT the condition automatically when it occurs on the canvas
2. SHOW visual feedback (badge, outline, heatmap change, link color)
3. CREATE a finding in the Network Intelligence panel with severity
4. EXPLAIN why in a hover tooltip (reasons[])
5. SUGGEST a fix (suggestions[])

Test each scenario by building it manually on the canvas and confirming
the system reacts correctly.

---

## CATEGORY 1: CONNECTIVITY & PATH (Scenarios 1–10)

### SC-01: No Internet Path
**Trigger:** User places a Router, connects PCs to it, but the Router
has no connection to a Cloud/ISP or Firewall with WAN link.
**Expected:**
- All devices behind the router show badge: "No Internet"
- Finding: 🟡 "Router 'Main Router' has no upstream WAN connection — devices can reach each other but not the internet"
- Suggestion: "Connect Router to a Cloud/ISP node or Firewall with WAN uplink"
- Visual: Router gets an amber warning icon overlay

### SC-02: Isolated Device
**Trigger:** User places a Laptop on the canvas with zero connections
(no wire, no WiFi coverage from any AP/Router).
**Expected:**
- Badge: "No Network" (red)
- Finding: 🔴 "Laptop-1 is not connected to any network — no wired link and no WiFi coverage"
- Suggestion: "Connect Laptop-1 to a switch via Ethernet, or place an AP within range"

### SC-03: Orphan Switch
**Trigger:** Switch connected to PCs but not connected upward to any
router or other switch.
**Expected:**
- Switch badge: "Isolated" (purple)
- All devices behind it: "Isolated"
- Finding: 🔴 "Switch-2 and 6 connected devices have no path to a gateway"
- Suggestion: "Connect Switch-2 to a router or upstream switch"

### SC-04: Loop Detection (Simple)
**Trigger:** Switch-A connects to Switch-B, Switch-B connects to
Switch-C, Switch-C connects back to Switch-A, with no indication of
STP or redundancy group.
**Expected:**
- Finding: 🟡 "Potential switching loop detected: Switch-A ↔ Switch-B ↔ Switch-C ↔ Switch-A. Ensure STP is enabled."
- Suggestion: "Configure Spanning Tree Protocol (STP) or mark one link as standby in a redundancy group"

### SC-05: Gateway Reachability
**Trigger:** Device is connected through multiple hops
(PC → Switch → Switch → Router), all links valid.
**Expected:**
- Path traced correctly: 3 hops to gateway
- Badge: "Good" or "Excellent"
- If user clicks Trace Route: animated path shown with per-hop latency

### SC-06: Broken Chain
**Trigger:** PC → Switch-A → (nothing) ... Router exists but is not
connected to Switch-A.
**Expected:**
- PC and Switch-A both show "Isolated"
- Finding: 🔴 "Switch-A has no upstream path to any router/gateway"
- Trace Route from PC to Router: "No path found"

### SC-07: Cloud Without Firewall
**Trigger:** Cloud/ISP node connected directly to a Switch or Router
without passing through a Firewall.
**Expected:**
- Finding: 🔴 CRITICAL "Cloud/ISP is connected directly to internal network without a firewall — severe security risk"
- Suggestion: "Place a Firewall between Cloud/ISP and Router"
- Visual: The Cloud→Router link gets a red warning indicator

### SC-08: Double NAT
**Trigger:** Two routers connected in series (Cloud → Router-1 → Router-2 → Switch → devices).
**Expected:**
- Finding: 🟡 "Two routers in series may cause double NAT — devices behind Router-2 may have connectivity issues with port forwarding and some applications"
- Suggestion: "Set Router-2 to bridge/AP mode, or use a switch instead"

### SC-09: WiFi Client Connected to Wrong SSID
**Trigger:** Laptop has preferredSsid: "Guest" but is in a Staff zone
that requires VLAN10 (Corporate).
**Expected:**
- Finding: 🟡 "Laptop-3 is on Guest SSID but located in Staff zone — may lack access to staff resources"
- Suggestion: "Change Laptop-3 SSID to Corporate, or move it to the Guest zone"

### SC-10: Device Connected Through Patch Panel Only
**Trigger:** PC connected to Patch Panel, but Patch Panel is not
connected to any active device (switch/router).
**Expected:**
- PC badge: "No Network"
- Finding: 🔴 "PC-4 is connected only to Patch Panel-1 which has no active uplink — patch panels are passive and require connection to a switch"
- Suggestion: "Connect Patch Panel-1 to a switch"

---

## CATEGORY 2: WIRELESS & COVERAGE (Scenarios 11–22)

### SC-11: WiFi Client Too Far from AP
**Trigger:** Laptop placed 250 canvas units from the nearest AP
(AP maxRadius = 240).
**Expected:**
- Badge changes as user drags: Good → Weak → Slow → No Network
- Finding: 🔴 "Laptop-2 is outside WiFi range of all access points (nearest: AP-1 at 250 units, max range: 240)"
- Suggestion: "Move Laptop-2 closer to AP-1, or add a new AP nearby"

### SC-12: Wall Blocks WiFi Signal
**Trigger:** AP on one side of a thick concrete wall, Laptop on the
other side, within range but wall adds 20dB attenuation.
**Expected:**
- Signal score drops significantly (e.g., from 75 to 35)
- Badge changes from "Good" to "Slow"
- Finding: 🟡 "Laptop-1 signal degraded by thick concrete wall (-20 dB) between it and AP-1"
- Heatmap shows reduced coverage on the far side of the wall
- Suggestion: "Add an AP on the other side of the wall, or switch to wired connection"

### SC-13: Multiple Barriers Stacking
**Trigger:** Signal path from AP to Laptop crosses 2 concrete walls
and 1 glass partition.
**Expected:**
- Attenuation stacked: 20 + 20 + 7 = 47 dB total loss
- Badge: "No Network" or "Slow"
- Finding explains EACH barrier crossed with individual dB loss
- Tooltip: "Signal crosses: Concrete Wall-1 (-20 dB), Concrete Wall-2 (-20 dB), Glass Partition (-7 dB)"

### SC-14: AP Overloaded (Too Many Clients)
**Trigger:** AP has capacityClients: 30, but 40 WiFi devices are
within its coverage.
**Expected:**
- AP badge: "Overloaded" (red)
- Weakest-signal clients get degraded first (congestion penalty)
- Finding: 🟡 "AP-2 is serving 40 clients (capacity: 30) — performance degraded for all connected devices"
- Suggestion: "Add another AP to offload clients, or reduce device count"
- Score card: Capacity drops

### SC-15: Co-Channel Interference
**Trigger:** AP-1 (channel 6) and AP-2 (channel 6) are within
150 canvas units of each other.
**Expected:**
- Both APs get interference penalty applied to overlapping clients
- Finding: 🟡 "AP-1 and AP-2 both use Channel 6 and overlap — co-channel interference reduces performance for 12 devices"
- Suggestion: "Change AP-2 to Channel 1 or Channel 11"
- Heatmap: interference zone shows striped/cross-hatched overlay

### SC-16: Coverage Gap in Room
**Trigger:** Room "Meeting Room" contains 5 wireless devices but no
AP inside, and nearest AP is far or behind a thick wall.
**Expected:**
- Multiple devices show "Weak" or "Slow"
- Finding: 🟡 "Meeting Room has 5 wireless devices but no AP — average signal score: 32"
- Suggestion: "Add an AP inside Meeting Room"
- AP Placement Advisor: ghost circle appears inside the room

### SC-17: RF Shield Blocking All Signal
**Trigger:** Server room has rf_shield barrier around it. A laptop
is placed inside with no AP inside.
**Expected:**
- Laptop: "No Network" (red)
- Finding: 🔴 "Laptop-5 is inside RF-shielded area with no local AP — WiFi signals cannot penetrate shielding"
- Suggestion: "Place an AP inside the shielded area, or connect via Ethernet"
- Heatmap: no coverage inside the shielded zone at all

### SC-18: AP Without Backhaul
**Trigger:** AP placed on canvas but not connected to any switch or
router via wired link. AP wifiEnabled: true.
**Expected:**
- AP badge: "No Backhaul" (amber)
- Clients can see the AP but it has no internet/network path
- Finding: 🟡 "AP-3 is broadcasting WiFi but has no wired backhaul — clients will connect but have no network access"
- Suggestion: "Connect AP-3 to a switch or router via Ethernet"

### SC-19: Weak Signal But Functional
**Trigger:** Laptop at 180 canvas units from AP, score = 45.
**Expected:**
- Badge: "Weak" (amber) — NOT an error, just a warning
- Finding: 🔵 INFO "Laptop-1 has weak WiFi signal (45/100) — usable but may experience occasional drops"
- No urgent fix needed, but suggestion offered: "Move closer or add AP"

### SC-20: Mesh Backhaul Bottleneck
**Trigger:** AP has backhaulType: "wifi_mesh" and serves 20 clients
requiring total 200Mbps, but mesh backhaul limited to 100Mbps.
**Expected:**
- Finding: 🟡 "AP-2 mesh backhaul (100 Mbps) is slower than total client demand (200 Mbps) — clients will experience slowdowns"
- Suggestion: "Switch AP-2 backhaul to Ethernet for better throughput"

### SC-21: 2.4GHz vs 5GHz Range Difference
**Trigger:** AP set to 5GHz only (shorter range, faster speed) and
client is at medium distance.
**Expected:**
- 5GHz AP has smaller coverageRadius than dual-band
- Finding: 🔵 "Laptop-6 is at the edge of AP-1's 5GHz range — consider enabling dual-band for better coverage at this distance"
- Suggestion: "Switch AP-1 to dual-band or add a 2.4GHz AP"

### SC-22: Dense Environment Noise Penalty
**Trigger:** Room marked as environment: "dense", noiseLevel: "high".
AP inside the room.
**Expected:**
- All clients in that room get noise penalty (-12 to signal score)
- Finding: 🔵 "Office Area has high noise level — WiFi performance reduced for all devices in this zone"
- Suggestion: "Use wired connections for critical devices, or upgrade to WiFi 6E (6GHz) to avoid congestion"

---

## CATEGORY 3: VLAN & SECURITY (Scenarios 23–32)

### SC-23: Device in Wrong VLAN for Zone
**Trigger:** PC assigned to VLAN20 (Guest) but placed inside a zone
with requiredVlan: VLAN10 (Staff).
**Expected:**
- Finding: 🟡 "PC-3 is on VLAN20 (Guest) but located in Staff zone (requires VLAN10) — may lack access to staff resources"
- Auto Fix: "Change PC-3 VLAN to VLAN10"
- Compliance Mode: device highlighted with violation badge

### SC-24: Server in Public Zone
**Trigger:** Server placed inside a zone with securityLevel: "public".
**Expected:**
- Finding: 🔴 HIGH "File Server is in a public zone — sensitive data exposed to unauthorized access"
- Suggestion: "Move File Server to a restricted or server_room zone"
- Compliance Mode: server gets red violation overlay

### SC-25: Guest VLAN Reaches Server VLAN Without Firewall
**Trigger:** Guest devices and servers are on different VLANs, but
both VLANs go through the same switch to the same router with no
firewall or ACL between them.
**Expected:**
- Finding: 🔴 "Guest VLAN (VLAN20) can reach Server VLAN (VLAN10) through Router-1 — no firewall or ACL boundary exists"
- Suggestion: "Add a firewall between Guest and Server segments, or configure inter-VLAN ACLs on the router"

### SC-26: IoT Device on Corporate VLAN
**Trigger:** IoT Gateway or smart device assigned to the corporate VLAN.
**Expected:**
- Finding: 🟡 "IoT Gateway-1 is on Corporate VLAN — IoT devices should be isolated to prevent lateral attacks"
- Suggestion: "Create a dedicated IoT VLAN and move IoT Gateway-1 to it"
- Auto Fix: assign device to IoT VLAN

### SC-27: Camera Not on Security VLAN
**Trigger:** IP Camera placed on VLAN10 (Staff) instead of a
dedicated security/camera VLAN.
**Expected:**
- Finding: 🟡 "IP Camera-1 is on Staff VLAN — cameras should be on a dedicated security VLAN for isolation"
- Suggestion: "Create VLAN50 (Security) and assign IP Camera-1 to it"

### SC-28: Printer on Guest VLAN
**Trigger:** Printer assigned to Guest VLAN.
**Expected:**
- Finding: 🟡 "Printer-1 is on Guest VLAN — guest users will have print access, which may not be intended"
- Suggestion: "Move Printer-1 to Staff VLAN, or restrict print access via ACLs"

### SC-29: AP Trunk Missing Required VLAN
**Trigger:** AP broadcasts SSID "Guest" (VLAN30), but the AP's uplink
trunk to the switch only carries VLAN10 and VLAN20 (trunkVlans missing
VLAN30).
**Expected:**
- Finding: 🔴 "AP-1 broadcasts Guest SSID (VLAN30) but uplink trunk does not carry VLAN30 — guest traffic cannot reach the gateway"
- Suggestion: "Add VLAN30 to the trunk link between AP-1 and Switch-1"
- Auto Fix: add VLAN30 to trunk

### SC-30: No VLAN Segmentation at All
**Trigger:** Entire topology has zero VLAN assignments — everything
on a flat network.
**Expected:**
- Finding: 🟡 "No VLAN segmentation detected — all devices share a single broadcast domain, increasing security risk and broadcast traffic"
- Suggestion: "Create VLANs to segment traffic: Staff, Guest, Servers, IoT, Security"

### SC-31: NAS in Guest Zone
**Trigger:** NAS device placed in a zone with securityLevel: "public"
or zoneType: "guest_area".
**Expected:**
- Finding: 🔴 "NAS-1 is in a guest area — network storage should be in a restricted or server zone"
- Suggestion: "Move NAS-1 to Server Room"

### SC-32: Restricted Zone with Unauthorized Device Type
**Trigger:** Zone has allowedDeviceTypes: ["server", "nas", "switch", "pdu"]
but user places a Laptop inside it.
**Expected:**
- Finding: 🟡 "Laptop-4 is placed in Server Room — this zone only allows: server, NAS, switch, PDU"
- Suggestion: "Move Laptop-4 to an appropriate zone, or update zone policy"

---

## CATEGORY 4: CAPACITY & BANDWIDTH (Scenarios 33–38)

### SC-33: Uplink Bottleneck
**Trigger:** Switch-A connects to Router via 1Gbps Ethernet.
10 devices behind Switch-A each require 200Mbps = 2Gbps total demand.
**Expected:**
- Finding: 🟡 "Switch-A uplink to Router (1 Gbps) is undersized for estimated demand (2 Gbps) — devices will experience slowdowns"
- Suggestion: "Upgrade uplink to 10 Gbps, or add a second uplink with link aggregation"
- Link shows orange/red in bandwidth heatmap mode

### SC-34: WAN Bandwidth Insufficient
**Trigger:** Cloud/ISP link is 100Mbps. Total estimated demand from
all critical devices is 300Mbps.
**Expected:**
- Finding: 🟡 "WAN link (100 Mbps) cannot support total critical demand (300 Mbps) — internet access will be slow"
- Suggestion: "Upgrade WAN link or implement QoS to prioritize critical traffic"

### SC-35: AP Backhaul Slower Than WiFi Speed
**Trigger:** AP supports WiFi 6 (up to 1200Mbps combined) but is
connected to the switch via 100Mbps Ethernet backhaul.
**Expected:**
- Finding: 🟡 "AP-1 backhaul (100 Mbps Ethernet) limits WiFi throughput — clients cannot reach full wireless speed"
- Suggestion: "Upgrade AP-1 backhaul to Gigabit Ethernet"

### SC-36: Server on Slow Link
**Trigger:** File Server connected via 100Mbps link, server criticality
set to "high", expected load 500Mbps.
**Expected:**
- Finding: 🟡 "File Server uplink (100 Mbps) is severely undersized for expected load (500 Mbps) — high-criticality device"
- Suggestion: "Upgrade to 1 Gbps or 10 Gbps link"

### SC-37: Switch Port Exhaustion
**Trigger:** Switch has 24 ports (default), but 26 devices are
connected to it.
**Expected:**
- Finding: 🟡 "Switch-1 has 26 connections but only 24 ports — 2 devices cannot be physically connected"
- Suggestion: "Add a second switch, or use a larger switch (48-port)"
- Port visualization: all ports green, 2 overflow indicators

### SC-38: Camera Bandwidth on Shared Link
**Trigger:** 4 IP cameras (each requiring 8Mbps = 32Mbps total)
connected to a 100Mbps switch uplink that also serves 10 PCs.
**Expected:**
- Finding: 🔵 "4 cameras consume 32 Mbps on Switch-2's 100 Mbps uplink alongside 10 PCs — utilization at ~72%, monitor for degradation"
- Suggestion: "Consider a dedicated switch or VLAN for camera traffic"

---

## CATEGORY 5: CABLE & PHYSICAL (Scenarios 39–43)

### SC-39: Ethernet Cable Too Long
**Trigger:** Connection between Switch and PC with cableLengthM: 120
(Ethernet max = 100m).
**Expected:**
- Finding: 🟡 "Ethernet cable from Switch-1 to PC-8 is 120m — exceeds maximum 100m for copper, signal degradation likely"
- Suggestion: "Shorten the cable run, add an intermediate switch, or use fiber"
- Connection line shows warning indicator

### SC-40: Fiber to Non-Fiber Device
**Trigger:** Connection type set to Fiber between Switch and a
standard PC (which only has RJ45 Ethernet port).
**Expected:**
- Finding: 🟡 "Fiber link to PC-2 — PC does not have a fiber-capable port (media mismatch)"
- Suggestion: "Use a media converter, or switch to Ethernet (copper)"

### SC-41: Cable Crosses Barrier with blocksCablePath
**Trigger:** A wired Ethernet link visually crosses a barrier that
has blocksCablePath: true (e.g., elevator shaft, fire wall).
**Expected:**
- Finding: 🟡 "Ethernet cable from Switch-1 to AP-3 crosses Elevator Shaft — cable routing is physically blocked"
- Suggestion: "Reroute the cable around the barrier, or use a cable conduit"
- Visual: yellow ⚠ on the crossing point, different from wall-crossing WiFi warning

### SC-42: Outdoor Cable Without Protection
**Trigger:** Ethernet cable runs between a device in an indoor zone
and a device in a zone with zoneType: "outdoor".
**Expected:**
- Finding: 🔵 "Ethernet cable between Indoor Switch and Outdoor Camera crosses indoor/outdoor boundary — use weatherproof rated cable and conduit"
- Suggestion: "Use outdoor-rated Cat6 shielded cable or fiber"

### SC-43: Long Fiber Run Without Amplification
**Trigger:** Single-mode fiber connection with cableLengthM: 50000
(50km, exceeding typical 40km limit without amplification).
**Expected:**
- Finding: 🟡 "Single-mode fiber run (50 km) may exceed typical distance without amplification (~40 km)"
- Suggestion: "Add an optical amplifier or signal repeater"

---

## CATEGORY 6: POWER & PoE (Scenarios 44–47)

### SC-44: PoE Device on Non-PoE Switch
**Trigger:** IP Camera with poeRequired: true connected to a Switch
that has poe: "none".
**Expected:**
- Camera badge: "PoE!" (yellow-red)
- Finding: 🔴 "IP Camera-1 requires PoE power but Switch-1 does not support PoE — camera will not power on"
- Suggestion: "Replace Switch-1 with a PoE switch, or use a separate PoE injector"

### SC-45: PoE Budget Exceeded
**Trigger:** PoE switch with 150W budget, but 10 PoE devices connected
at 15.4W each = 154W total.
**Expected:**
- Finding: 🟡 "Switch-1 PoE budget (150W) exceeded by connected devices (154W) — some devices may not receive power"
- Suggestion: "Reduce PoE devices, upgrade to higher-budget switch, or use external PoE injectors"

### SC-46: Critical Device Without UPS
**Trigger:** Server with criticality: "critical" but no PDU/UPS
connected or in a power zone that covers it.
**Expected:**
- Finding: 🟡 "File Server (critical) has no UPS/PDU backup — power outage will cause immediate downtime"
- Suggestion: "Connect File Server to a UPS, or place it in a UPS-covered power zone"

### SC-47: AP Without Power Source
**Trigger:** Ceiling-mounted AP with poeRequired: true, not connected
to any PoE-capable switch, and no external power source indicated.
**Expected:**
- Badge: "Power Missing" (yellow-red)
- Finding: 🔴 "AP-2 requires PoE but has no power source — AP will not function"
- Suggestion: "Connect to a PoE switch, add a PoE injector, or provide local AC power"

---

## CATEGORY 7: RESILIENCE & FAILURE (Scenarios 48–55)

### SC-48: Single Point of Failure — Core Switch
**Trigger:** One switch connects to the router AND all APs, servers,
and other switches depend on it. No redundant path.
**Expected:**
- Finding: 🔴 "Switch-1 is a single point of failure for 15 devices — if it fails, entire network goes down"
- Suggestion: "Add a second core switch with redundant uplinks"
- Failure Impact Mode: clicking Switch-1 shows 15 devices going red

### SC-49: Single Firewall (No HA)
**Trigger:** Enterprise template with one firewall handling all traffic.
**Expected:**
- Finding: 🟡 "Firewall-1 is the only WAN security device — no high-availability pair configured"
- Suggestion: "Add a second firewall in HA (active/passive) for enterprise resilience"

### SC-50: Server With Single Uplink
**Trigger:** Critical server connected to only one switch via one link.
No redundantGroup configured.
**Expected:**
- Finding: 🟡 "App Server (critical) has only one network uplink — link failure will cause downtime"
- Suggestion: "Add a second NIC connected to a different switch for redundancy"

### SC-51: All APs on One Switch
**Trigger:** 4 APs all connected to the same switch. If that switch
fails, all WiFi goes down.
**Expected:**
- Finding: 🟡 "All 4 APs depend on Switch-2 — if Switch-2 fails, 100% of wireless coverage is lost"
- Suggestion: "Distribute APs across multiple switches for wireless resilience"
- Failure Impact Mode: Switch-2 failure → all coverage circles disappear

### SC-52: Single WAN Link
**Trigger:** Only one Cloud/ISP connection to the network.
**Expected:**
- Finding: 🔵 "Only one WAN link exists — internet outage has no failover"
- Suggestion: "Add a backup WAN link from a different ISP for redundancy"

### SC-53: Cascading Failure Chain
**Trigger:** Cloud → Firewall → Router → Switch-1 → Switch-2 → devices.
No redundancy at any hop.
**Expected:**
- Finding: 🟡 "Network has a linear chain with no redundancy — any single device failure breaks connectivity for all downstream devices"
- Failure Impact Mode on Router: shows Firewall still OK, but Switch-1, Switch-2, and all devices go red

### SC-54: Redundancy Correctly Configured
**Trigger:** Two switches in redundantGroup "core", both connected to
router. Server dual-homed to both switches.
**Expected:**
- Finding: ✅ NONE for these devices — resilience score should be high
- Server badge: "Excellent" (green)
- Failure Impact Mode on Switch-1: Server stays green (still connected via Switch-2)

### SC-55: Power Chain Failure
**Trigger:** PDU/UPS powers Switch-1, which powers 3 PoE APs.
User simulates PDU failure.
**Expected:**
- PDU goes offline → Switch-1 badge: "Power Missing"
- Switch-1 going offline → 3 APs: "No Backhaul" + "Power Missing"
- All wireless clients behind those APs: "No Network"
- Impact summary: "PDU-1 failure affects: 1 switch, 3 APs, 22 wireless clients"

---

## BONUS CATEGORY: POSITIVE CONFIRMATIONS (Scenarios 56–60)

These are "happy path" scenarios — the engine should confirm good design.

### SC-56: Well-Designed Small Office
**Trigger:** Router → Firewall → Cloud. Two switches. 3 APs (one per room).
All VLANs configured. PoE switches. UPS on server.
**Expected:**
- All scores green (>75)
- No errors, maybe 1-2 blue info suggestions
- Badge on all devices: "Excellent" or "Good"
- Overall score: 85+

### SC-57: Full Redundancy Enterprise
**Trigger:** Dual firewalls (HA), dual switches, dual WAN, servers
dual-homed, APs distributed across switches.
**Expected:**
- Resilience score: 95+
- Failure Impact Mode on any single device: no devices go fully offline
- Finding: ✅ "Topology has full redundancy — no single point of failure detected"

### SC-58: Proper VLAN Segmentation
**Trigger:** Staff VLAN, Guest VLAN, Server VLAN, IoT VLAN, Security VLAN
all configured with devices in correct zones.
**Expected:**
- Security score: 90+
- No VLAN compliance violations
- Compliance Mode: all zones clean, no violations highlighted

### SC-59: Good AP Placement
**Trigger:** 3 APs on different channels (1, 6, 11), one per room,
all clients have signal score > 70.
**Expected:**
- Coverage score: 90+
- No co-channel interference
- Heatmap: full cyan/blue coverage across all rooms

### SC-60: Correct PoE Configuration
**Trigger:** All cameras and APs connected to PoE switches.
PDU/UPS powering the switches. PoE budget not exceeded.
**Expected:**
- No power findings
- Power score: 95+
- All cameras and APs: no "PoE!" badges

---

## IMPLEMENTATION PRIORITY

**Phase 1 — Core (must have, build first):**
SC-01, SC-02, SC-03, SC-07, SC-11, SC-12, SC-14, SC-18, SC-23, SC-24,
SC-29, SC-39, SC-44, SC-48

These 14 scenarios cover: basic connectivity, WiFi coverage, security
basics, cable limits, PoE, and SPOF detection. Once these work, the
app already feels incredibly smart.

**Phase 2 — Important (build second):**
SC-04, SC-06, SC-09, SC-13, SC-15, SC-16, SC-25, SC-26, SC-27, SC-30,
SC-33, SC-34, SC-37, SC-46, SC-50, SC-51

These 16 scenarios add: interference, multi-barrier, VLAN depth,
bandwidth, port limits, and more resilience checks.

**Phase 3 — Advanced (build last):**
SC-05, SC-08, SC-10, SC-17, SC-19, SC-20, SC-21, SC-22, SC-28, SC-31,
SC-32, SC-35, SC-36, SC-38, SC-40, SC-41, SC-42, SC-43, SC-45, SC-47,
SC-49, SC-52, SC-53, SC-54, SC-55, SC-56, SC-57, SC-58, SC-59, SC-60

These 30 scenarios add: edge cases, advanced capacity, power chains,
happy paths, and full polish.

---

## ENGINE ARCHITECTURE HINT

All 60 scenarios can be implemented as a single `evaluateTopology()`
function that runs on every canvas state change (debounced 200ms).

```typescript
function evaluateTopology(state: CanvasState): SmartResult {
  const findings: Finding[] = [];
  const deviceStates: Map<string, DeviceState> = new Map();

  // 1. Build connectivity graph (BFS/DFS from gateway)
  // 2. Calculate WiFi signal for each wireless client
  // 3. Check VLAN compliance per zone
  // 4. Check capacity per AP, switch, uplink
  // 5. Check cable/PoE/power rules
  // 6. Detect single points of failure (graph analysis)
  // 7. Calculate scores (coverage, capacity, security, resilience, power)

  return { findings, deviceStates, scores };
}
```

Each scenario maps to one or more checks inside this function.
The function returns the complete smart state, which the UI reads
to show badges, findings, scores, and heatmap data.
