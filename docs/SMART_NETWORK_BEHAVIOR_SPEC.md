# Smart Network Behavior Spec

This document is a product and implementation planning draft for making TopologAi feel smart even when no AI provider is used. The goal is a deterministic network-simulation layer that reacts to the topology the user draws: device positions, room zones, walls, barriers, links, VLANs, bandwidth, and device roles.

The app already has useful building blocks:

- Devices: router, switch, access point, firewall, cloud/ISP, server, NAS, PC, laptop, printer, camera, phone, tablet, IoT gateway, PDU/UPS, patch panel, smart TV, load balancer.
- Links: Ethernet, fiber, WiFi, WAN, VPN.
- Rooms/zones: rectangular areas that contain devices.
- Network Intelligence panel: current validation, score, findings, and recommendations.
- Properties panel: selected device, link, and room editing.

This spec proposes extra data fields, smart rules, UI feedback, and priority phases. Nothing here requires generative AI.

## Product Goal

Make the canvas behave like a living network design tool:

- If a wireless device is too far from a router/AP, show weak signal or no network.
- If a thick wall or barrier sits between a client and router/AP, lower signal and speed.
- If a room is overloaded with too many WiFi clients, show congestion.
- If a device is placed in the wrong zone or VLAN, show a security finding.
- If a cable is too long, wrong type, or undersized for the traffic, show bottleneck warnings.
- If a firewall, switch, router, or uplink becomes a single point of failure, show risk.
- If power is missing or a device depends on a failed PDU/UPS, show offline impact.

The key design principle: every smart warning must explain why it appears and what action fixes it.

## Core Concepts

### 1. Smart Zones

Rooms should become network-aware zones instead of only visual rectangles.

Proposed zone fields:

| Field | Example | Purpose |
| --- | --- | --- |
| `zoneType` | `office`, `server_room`, `guest_area`, `outdoor`, `storage`, `restricted`, `iot_area` | Enables zone-specific recommendations. |
| `floor` | `1`, `2`, `basement` | Allows multi-floor signal and path penalties later. |
| `environment` | `open`, `dense`, `industrial`, `residential` | Adds realistic wireless noise. |
| `maxUsers` | `25` | Helps detect overcrowded WiFi zones. |
| `requiredVlan` | `VLAN10` | Warns when devices inside zone use wrong VLAN. |
| `allowedDeviceTypes` | `server,nas,switch,pdu` | Warns when a device is placed in a restricted zone. |
| `securityLevel` | `public`, `staff`, `restricted`, `critical` | Drives access and exposure findings. |
| `defaultWallMaterial` | `drywall`, `glass`, `concrete` | Used for room-border signal loss when no custom barrier exists. |
| `wallThickness` | `thin`, `medium`, `thick` | Adds attenuation around the room border. |
| `noiseLevel` | `low`, `medium`, `high` | Reduces WiFi quality in busy zones. |

Smart behaviors:

- Devices inside a guest zone should default to or recommend guest VLAN.
- Servers inside a public zone should produce a high-severity security finding.
- APs inside dense zones should have smaller practical coverage.
- Security cameras outside the security zone should warn if no recording/NAS path exists.
- Printers in restricted/server zones should warn unless explicitly allowed.
- If a zone contains no AP/router and no wired uplink, show "coverage gap".

### 2. Coverage Sources

Routers and access points should have coverage profiles.

Proposed fields for router/AP devices:

| Field | Example | Purpose |
| --- | --- | --- |
| `wifiEnabled` | `true` | Enables wireless coverage. |
| `coverageRadius` | `180` | Canvas-distance radius for usable signal. |
| `maxRadius` | `240` | Absolute edge where signal becomes "no network". |
| `wifiBand` | `2.4GHz`, `5GHz`, `6GHz`, `dual`, `tri` | Changes range and speed behavior. |
| `txPower` | `low`, `medium`, `high` | Adjusts radius and interference. |
| `channel` | `1`, `6`, `11`, `auto` | Allows co-channel interference warnings. |
| `capacityClients` | `30` | Warns when too many clients connect. |
| `backhaulType` | `ethernet`, `wifi_mesh`, `powerline` | Explains upstream bottlenecks. |
| `ssid` | `Corporate`, `Guest` | Connects wireless clients to VLAN/security rules. |
| `supportedVlans` | `VLAN10,VLAN30` | Warns if clients need VLANs not carried by the AP. |

Coverage logic:

- Wireless clients connect to the best AP/router based on calculated signal score.
- Signal score starts from distance and is reduced by barriers, walls, floors, interference, and AP load.
- A client with score below the offline threshold becomes `No network`.
- A client above offline but below fair threshold becomes `Slow`.
- A client with good score but congested AP becomes `Congested`.

Suggested thresholds:

| Signal Score | State | UI Label |
| --- | --- | --- |
| `80-100` | Healthy | Excellent |
| `60-79` | Healthy | Good |
| `40-59` | Warning | Weak |
| `20-39` | Warning | Slow |
| `0-19` | Critical | No network |

### 3. Barrier Item

Add a new canvas item that acts as a physical blocker or signal modifier. This should be separate from rooms because a barrier can be a wall, shelf, elevator shaft, glass partition, metal rack, fire door, or custom object.

Proposed barrier types:

| Barrier Type | Signal Loss | Example Use |
| --- | --- | --- |
| `drywall` | low | Normal office wall. |
| `glass` | low-medium | Meeting room glass. |
| `wood` | low-medium | Residential wall or cabinet. |
| `brick` | medium | Older building wall. |
| `concrete` | high | Thick structural wall. |
| `metal` | very high | Rack row, elevator, storage cage. |
| `water` | very high | Aquarium, water tank, industrial area. |
| `rf_shield` | full block | Lab, Faraday room, restricted facility. |
| `custom` | user-defined | Anything else. |

Proposed barrier fields:

| Field | Example | Purpose |
| --- | --- | --- |
| `barrierType` | `concrete` | Determines default attenuation. |
| `thickness` | `thin`, `medium`, `thick`, `custom` | Multiplies attenuation. |
| `attenuationDb` | `18` | Advanced override. |
| `blocksWifi` | `true` | Hard-block option for shielded spaces. |
| `blocksCablePath` | `false` | Useful for cable routing later. |
| `label` | `Concrete wall` | User-facing display. |
| `x1,y1,x2,y2` or shape bounds | line or rectangle | Enables line-of-sight checks. |

Smart behaviors:

- If the line between AP and wireless client crosses a barrier, reduce signal.
- If it crosses multiple barriers, stack attenuation.
- If it crosses `rf_shield`, show `No network` unless there is an AP inside the shielded zone.
- If a cable link crosses a barrier with `blocksCablePath`, warn that the cable route is invalid.
- If an AP is behind thick concrete from most clients, recommend moving the AP or adding another AP.

### 4. Room Border Thickness

The user specifically mentioned a room border being thick. Treat thick room borders as implicit barriers when no explicit barrier item exists.

Suggested mapping:

| Room Wall Material | Thin | Medium | Thick |
| --- | ---: | ---: | ---: |
| Drywall | 3 dB | 5 dB | 8 dB |
| Glass | 4 dB | 7 dB | 10 dB |
| Brick | 8 dB | 12 dB | 18 dB |
| Concrete | 12 dB | 20 dB | 30 dB |
| Metal | 20 dB | 35 dB | 50 dB |

Behavior:

- If an AP and client are in different rooms, count each room border crossed.
- If the room has `wallThickness: thick` and `defaultWallMaterial: concrete`, signal may become slow or no network.
- If a router/AP is outside a room and many devices inside that room are weak, recommend adding an AP inside the room.

### 5. Wireless Client Behavior

Wireless-capable device types:

- laptop
- tablet
- phone
- printer
- smarttv
- iot
- camera if `connectionMode: wifi`
- pc if `wifiAdapter: true`

Proposed fields:

| Field | Example | Purpose |
| --- | --- | --- |
| `connectionMode` | `wifi`, `wired`, `auto` | Determines how connectivity is calculated. |
| `preferredSsid` | `Guest` | Maps client to AP/SSID. |
| `requiredBandwidthMbps` | `25` | Drives bottleneck warnings. |
| `mobility` | `fixed`, `mobile` | Mobile clients may need roaming coverage. |
| `criticality` | `low`, `normal`, `high`, `critical` | Impacts severity of findings. |
| `networkState` | calculated | Healthy, slow, offline, isolated, blocked. |

Smart behaviors:

- A laptop with no wired link and no AP coverage becomes `No network`.
- A tablet in a restricted zone on guest SSID warns if it can reach sensitive VLANs.
- A WiFi printer far from AP may show "slow printing / unreliable".
- A camera requiring 8 Mbps connected over weak WiFi should warn "video stream unstable".
- A smart TV requiring high bandwidth should recommend wired Ethernet if weak or congested.

### 6. Wired Link Intelligence

Links should evaluate capacity, distance, media type, and endpoint suitability.

Proposed fields:

| Field | Example | Purpose |
| --- | --- | --- |
| `bandwidthMbps` | `1000` | Machine-readable bandwidth. |
| `cableLengthM` | `80` | Warning for copper/fiber limits. |
| `poe` | `none`, `poe`, `poe+`, `poe++` | Power over Ethernet capability. |
| `latencyMs` | `1` | Optional simulation metric. |
| `utilizationPercent` | `65` | Manual or calculated load. |
| `redundantGroup` | `uplink-a` | Used for failover and redundancy checks. |
| `trunkVlans` | `VLAN10,VLAN20,VLAN30` | Validates VLAN transport. |

Smart behaviors:

- Ethernet over 100m warns "copper cable too long".
- AP connected by 100 Mbps Ethernet but serving many clients warns "AP backhaul bottleneck".
- Server connected through 1 Gbps while expected load is 2 Gbps warns "undersized uplink".
- Fiber link to an endpoint without fiber-capable port warns "media mismatch".
- Guest VLAN used by WiFi clients but missing from AP uplink trunk warns "guest traffic cannot reach gateway".
- PoE camera/AP connected to a non-PoE switch warns "device may not power on".

### 7. Device Capability Profiles

Each device type should have default capability rules.

Suggested defaults:

| Device Type | Smart Defaults |
| --- | --- |
| Router | Gateway, DHCP candidate, optional WiFi, routes VLANs. |
| Firewall | WAN edge protection, policy boundary, segmentation enforcement. |
| Switch | Wired aggregation, VLAN trunk/access validation, optional PoE. |
| Access Point | WiFi coverage source, SSID/VLAN mapping, client capacity. |
| Server | High bandwidth consumer/provider, should live in server/restricted zone. |
| NAS | Storage target, should avoid guest/public zone, bandwidth-sensitive. |
| Camera | Continuous bandwidth stream, often needs PoE, should be on camera/security VLAN. |
| Printer | Shared resource, should not be exposed to guest VLAN unless intentional. |
| IoT Gateway | Should be isolated from corporate/server VLANs. |
| PDU/UPS | Power dependency source for critical devices. |
| Patch Panel | Passive cable organization, should not be treated as active forwarding unless connected through switch. |
| Load Balancer | App traffic distribution, should connect client side and server side. |
| Cloud/ISP | External network, should normally connect through firewall before internal network. |

### 8. Network State Model

Each device should get a calculated `smartState` that explains the current result.

Proposed values:

| State | Meaning |
| --- | --- |
| `healthy` | Has valid path and enough quality/capacity. |
| `weak_signal` | Wireless is usable but poor. |
| `slow_network` | Signal, backhaul, cable, or congestion limits performance. |
| `no_network` | No usable wired or wireless path. |
| `isolated` | Connected to something, but not to gateway/required VLAN. |
| `blocked_by_policy` | Physical network exists but VLAN/firewall/zone policy blocks access. |
| `power_missing` | Device depends on PoE/PDU but no power source exists. |
| `at_risk` | Works now, but redundancy, capacity, or placement is risky. |

Each state should include `reasons`.

Example:

```json
{
  "deviceId": "n13",
  "smartState": "slow_network",
  "quality": 34,
  "reasons": [
    "Laptop is 210 units from AP - Lobby.",
    "Signal crosses 1 thick concrete room border.",
    "AP - Lobby already serves 34 clients, above recommended capacity 30."
  ],
  "suggestions": [
    "Move Laptop closer to AP - Lobby.",
    "Add an AP inside Office Area B.",
    "Use Ethernet for this device."
  ]
}
```

### 9. Network Intelligence Panel Upgrades

The existing Network Intelligence panel should show richer deterministic findings.

Recommended sections:

- Overall score: combine design score, coverage score, capacity score, and security score.
- Coverage: weak clients, offline clients, best/worst zones, AP load.
- Bottlenecks: overloaded uplinks, slow backhauls, cable length issues.
- Security: guest leakage, sensitive devices in public zones, missing firewall, missing VLANs.
- Resilience: single points of failure, missing redundant uplinks, no backup power.
- Power: PoE mismatch, UPS coverage gaps.
- Fix list: direct actions in plain language.

Example findings:

- `Laptop 2 has no network: outside WiFi coverage and no wired link.`
- `Guest WiFi AP is connected to a trunk that does not carry VLAN30.`
- `IP Camera 1 may fail: requires PoE but Store Switch has no PoE capability.`
- `Office Area B has poor coverage: 7 devices below 40 signal score.`
- `Core Switch is a single point of failure for 11 devices.`
- `NAS is in a public zone. Move it to Server Room or mark the zone as restricted.`

### 10. Visual Feedback

Smart behavior should be visible directly on the canvas.

Recommended visual layers:

- WiFi coverage rings around routers/APs.
- Heatmap overlay for signal quality.
- Red outline for `no_network` devices.
- Amber outline for `slow_network` and `weak_signal` devices.
- Small badge on devices: `OK`, `Slow`, `No Net`, `PoE`, `Risk`.
- Barrier objects drawn as labeled wall segments or rectangles.
- Room border thickness visually reflects wall thickness.
- Link thickness or color reflects capacity and congestion.
- Hover tooltip explains the current smart calculation.

Do not make the canvas noisy by default. Provide toggles:

- Show coverage
- Show heatmap
- Show barriers
- Show bottlenecks
- Show security zones
- Show power dependencies

### 11. Properties Panel Upgrades

Device properties:

- Connection mode: wired, WiFi, auto.
- Required bandwidth.
- Criticality.
- WiFi capability and preferred SSID.
- PoE requirement.
- Power source.
- Smart state summary with reasons.

Room properties:

- Zone type.
- Security level.
- Required VLAN.
- Wall material.
- Wall thickness.
- Noise level.
- Max users.

Link properties:

- Bandwidth as structured value.
- Cable length.
- Cable/media type.
- PoE capability.
- Trunk VLANs.
- Utilization.

Barrier properties:

- Barrier type.
- Thickness.
- Attenuation dB.
- Blocks WiFi.
- Blocks cable path.

### 12. Smart Rules Catalog

These rules can run locally whenever nodes, links, rooms, VLANs, or barriers change.

#### Coverage Rules

- If WiFi client has no wired link and no reachable AP/router, mark `no_network`.
- If signal score is below 40, mark `slow_network`.
- If signal score is below 20, mark `no_network`.
- If client is inside a room with thick concrete/metal border and AP is outside, reduce score strongly.
- If AP capacity is exceeded, mark lowest-signal clients as congested first.
- If two nearby APs share the same channel, warn about co-channel interference.
- If a zone has many wireless clients but no AP inside or nearby, recommend adding AP.

#### Barrier Rules

- If AP-client line crosses concrete/metal/water/rf_shield, reduce signal.
- If it crosses `rf_shield`, require an AP inside the same shielded area.
- If a wired link visually crosses a barrier that blocks cable path, warn.
- If most clients behind one barrier are slow, recommend AP relocation instead of only raising transmit power.

#### VLAN and Zone Rules

- If device VLAN does not match `requiredVlan` for its zone, warn.
- If guest VLAN can reach server/NAS VLAN without firewall boundary, warn.
- If camera is not on camera/security VLAN, warn.
- If IoT device is on corporate VLAN, warn.
- If server or NAS is in public/guest zone, high-severity finding.
- If firewall is missing between cloud/ISP and internal network, critical finding.

#### Capacity Rules

- Sum estimated client bandwidth through each AP, switch, router, and uplink.
- If estimated load is over 70% of capacity, warn.
- If over 90%, mark bottleneck.
- If AP backhaul is slower than wireless capacity and client count is high, warn.
- If WAN link is slower than total critical demand, warn.

#### Cable and Power Rules

- Ethernet cable longer than 100m warns.
- PoE device connected to non-PoE switch warns.
- Critical devices without UPS/PDU dependency warn.
- APs and cameras with PoE requirement but no PoE source show `power_missing`.
- Patch panels should not count as active network hops unless connected to a switch.

#### Resilience Rules

- Detect single points of failure.
- If all APs depend on one switch, show wireless outage impact if switch fails.
- If firewall is single device for entire network, suggest HA pair for enterprise/data center templates.
- If server/NAS has only one uplink and is marked critical, suggest redundant link.
- If only one WAN path exists in retail/campus/data center templates, suggest backup WAN.

### 13. Calculation Model

The first version can use simple deterministic math.

Wireless score:

```text
base = 100 - (distance / maxRadius) * 100
score = base - barrierLoss - roomWallLoss - floorLoss - noiseLoss - loadPenalty - interferencePenalty
score = clamp(score, 0, 100)
```

Suggested loss values:

| Factor | Loss |
| --- | ---: |
| Low room noise | 0 |
| Medium room noise | 5 |
| High room noise | 12 |
| AP load above 80% | 10 |
| AP load above 100% | 25 |
| Same-channel nearby AP | 8 |
| Different floor | 20 |

Capacity score:

```text
utilization = estimatedDemandMbps / availableBandwidthMbps
```

Suggested states:

- Under 70%: healthy.
- 70% to 90%: warning.
- Over 90%: bottleneck.
- Over 100%: slow/critical.

### 14. Data Shape Proposal

Possible topology payload extension:

```json
{
  "version": 2,
  "nodes": [],
  "links": [],
  "rooms": [],
  "vlans": [],
  "barriers": [],
  "smart": {
    "enabled": true,
    "showCoverage": true,
    "showHeatmap": false,
    "rulesVersion": 1
  }
}
```

Node extension:

```json
{
  "id": "n7",
  "type": "ap",
  "label": "AP - Lobby",
  "x": 400,
  "y": 500,
  "vlan": "VLAN30",
  "smart": {
    "wifiEnabled": true,
    "coverageRadius": 180,
    "maxRadius": 240,
    "wifiBand": "dual",
    "channel": "auto",
    "capacityClients": 30,
    "ssid": "Guest",
    "supportedVlans": ["VLAN30"],
    "poeRequired": true,
    "criticality": "normal"
  }
}
```

Room extension:

```json
{
  "id": "r3",
  "label": "Office Area B",
  "x": 450,
  "y": 440,
  "w": 320,
  "h": 220,
  "smart": {
    "zoneType": "office",
    "securityLevel": "staff",
    "requiredVlan": "VLAN20",
    "defaultWallMaterial": "concrete",
    "wallThickness": "thick",
    "noiseLevel": "medium",
    "maxUsers": 25
  }
}
```

Barrier:

```json
{
  "id": "b1",
  "type": "barrier",
  "label": "Concrete Wall",
  "shape": "line",
  "x1": 430,
  "y1": 400,
  "x2": 430,
  "y2": 700,
  "smart": {
    "barrierType": "concrete",
    "thickness": "thick",
    "attenuationDb": 30,
    "blocksWifi": true,
    "blocksCablePath": false
  }
}
```

### 15. Suggested New Palette Items

Add these non-device canvas items:

| Item | Purpose |
| --- | --- |
| Barrier / Wall | Blocks or weakens WiFi and cable routes. |
| Door | Lower attenuation than wall, useful for realistic floor plans. |
| Window / Glass | Moderate attenuation. |
| Metal Rack | Strong signal blocker, data center realism. |
| Elevator Shaft | Strong blocker for office/campus. |
| Outdoor Area | Higher range but weather/security warnings. |
| Noise Source | Interference source such as microwave, machinery, crowded event area. |
| Power Source / UPS Zone | Defines backup power coverage. |
| Cable Path / Conduit | Allows smarter routing and path validation later. |

### 16. "Amazing and Smart" Feature Ideas

High-impact ideas that will make the website feel impressive:

- Live coverage heatmap that updates while dragging APs or barriers.
- Device badges that change instantly as the user moves things.
- "Why is this slow?" hover tooltip with exact reasons.
- "Fix this" suggestions such as "Move AP 60 units right" or "Add AP inside Office Area B".
- Impact mode: click a switch/router/AP and show every device that would go offline if it fails.
- Zone compliance mode: highlight devices in wrong VLAN or wrong security zone.
- Bottleneck flow mode: animate traffic pressure along overloaded links.
- AP placement helper: ghost circles showing recommended AP positions for weak zones.
- Barrier-aware auto layout: avoid putting APs behind thick concrete from their clients.
- Template-specific rules: home, office, campus, data center, retail each gets different severity.
- Smart export: include coverage, bottleneck, and risk findings in the design brief.
- Smart score breakdown: Coverage, Security, Capacity, Resilience, Power.

### 17. MVP Priority

Phase 1 should deliver the biggest "smart" feeling with the lowest complexity:

1. Add smart fields to rooms: wall material, wall thickness, noise level, required VLAN.
2. Add AP/router coverage radius and wireless client connection state.
3. Add barrier item with material and thickness.
4. Calculate WiFi signal by distance plus barrier/room-wall penalty.
5. Show badges for `Good`, `Weak`, `Slow`, and `No Network`.
6. Add deterministic findings to Network Intelligence panel.
7. Add tooltips that explain why a device is slow/offline.

Phase 2:

1. Add capacity estimation and AP client load.
2. Add cable length and PoE checks.
3. Add VLAN trunk validation for APs and switches.
4. Add heatmap overlay.
5. Add zone security/compliance scoring.

Phase 3:

1. Add impact mode for device/link failures.
2. Add power dependency simulation.
3. Add recommended AP placement helper.
4. Add multi-floor logic.
5. Add smart design brief export with findings and fixes.

## Acceptance Criteria

The feature should feel successful when:

- Moving a laptop away from an AP changes its badge from `Good` to `Weak`, `Slow`, then `No Network`.
- Drawing a thick concrete barrier between AP and laptop immediately lowers the signal.
- Marking a room wall as thick concrete can make devices inside slow when the AP is outside.
- A device in the wrong VLAN/zone creates a clear security warning.
- A PoE camera connected to a non-PoE switch shows a power warning.
- The Network Intelligence panel explains the issue and suggests a specific fix.
- The system works offline and without any AI key.

