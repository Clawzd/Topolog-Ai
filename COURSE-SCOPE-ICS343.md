# TopologAi — Course Scope for ICS 343 (Term 252)

> **Purpose of this file:** This document is for the **team** to understand what
> TopologAi will look like *for the ICS 343 course submission only*.
> The full project on GitHub is much larger and will continue to be developed
> after the course. For the course we deliver a **smaller, focused version** so
> the team can explain it clearly without the original developer present.
>
> **Course:** ICS 343 — Fundamentals of Computer Networks (KFUPM, Term 252)
> **Instructor:** Dr. Hani Al-Mohair
> **Lab tools referenced by the syllabus:** Wireshark, Cisco Packet Tracer,
> Python (sockets), PuTTY, Cisco IOS, Windows CLI/PowerShell, Iperf3.

---

## 1. The One-Sentence Pitch (use this when explaining the project)

> **TopologAi is an AI-powered network topology designer: you describe a
> network in plain English, and the AI builds a working topology diagram with
> the right devices, links, VLANs, and IP addressing — exactly the same
> concepts ICS 343 teaches in lectures (TCP/IP layers, addressing, VLANs,
> routing).**

That sentence alone covers the whole course-version of the product.

---

## 2. What to KEEP (the course version)

These are the only features the team needs to demo and explain. Everything
else in the repo is hidden / disabled for the course build.

### 2.1 Core feature — the AI idea (DO NOT REMOVE)
- **Prompt → Topology generation** (`AIPanel.jsx` + `topologyAiProvider.js` + `promptTopologyGenerator.js`)
  - User types: *"Small office with 15 employees, 2 departments, WiFi"*
  - AI returns: routers, switches, PCs, APs, links, and VLANs.
  - This is the project's identity — keep it front and center.

### 2.2 Supporting features (kept, but simplified)
1. **Topology Canvas** (`TopologyCanvas.jsx`)
   - Drag, drop, connect devices.
   - Pan / zoom / select.
2. **Device library** (limited to course-relevant devices only):
   - Router, Switch, PC / Host, Server, Access Point, Firewall.
   - *(Drop the IoT, NAS, IP-camera, VoIP-phone, sensor, etc. for the course.)*
3. **VLAN view** (`VlanManager.jsx`)
   - Course directly covers VLANs (Wk 12, Wk 14 of the lab).
   - Keep "create VLAN, assign device to VLAN, color-highlight VLAN".
4. **IP addressing display**
   - Show each device's IPv4 address + subnet on hover or in a side panel.
   - Course covers IPv4 addressing (Wk 9 lab) and subnetting.
5. **Export / Save topology** (`ExportMenuModal.jsx`, simplified)
   - Save as PNG / JSON only. (Drop PDF, share-link, Cisco-config exports.)
6. **Reset / Clear canvas** + **Undo / Redo**.

That's it. Six supporting features + the AI = the whole course demo.

---

## 3. What to DELETE for the course version

These features are great for the real product but **out of scope for ICS 343**
and they make the demo confusing. Comment them out (don't actually delete the
files — we'll restore them after the semester).

| Feature | File(s) | Why remove for course |
|---|---|---|
| **Stripe payments** | `@stripe/*` packages | Not a networking concept. |
| **3D view / three.js** | `three` package | Not in syllabus. |
| **Geographic map (Leaflet)** | `react-leaflet`, map-aware AI | Out of scope; course uses logical topology, not geography. |
| **Heatmap mode** | `topologyUiStore: heatmapMode` | Proprietary feature, no syllabus link. |
| **Power view / Power zones** | `showPowerView`, `powerZones` | Not in syllabus. |
| **AP Advisor / WiFi heat coverage** | `showApAdvisor` | Not in syllabus. |
| **Compliance view** | `showComplianceView` | Not in syllabus. |
| **Failure impact simulation** | `FailureImpactModal.jsx` | Nice but confusing; keep for v2. |
| **Path tracing UI** | `pathTraceSource/Target` | Optional — only keep if we have time for routing demo. |
| **Network Insights drawer** | `NetworkInsightsPanel.jsx` | Too much for a demo; replace with a simple "device count" line. |
| **Template Gallery** | `TemplateGallery.jsx` | Redundant with AI generation — the AI is our templates. |
| **Environment toolbox** (rooms, barriers, zones) | `EnvironmentToolbox.jsx` | Not relevant to OSI/TCP-IP teaching. |
| **Onboarding tour** | `OnboardingTour.jsx` | Cut to keep the demo short. |
| **Workflow progress** | `WorkflowProgress.jsx` | Cut. |
| **Command palette + Keyboard shortcuts modal** | `CommandPalette.jsx`, `KeyboardShortcutsModal.jsx` | Power-user features; not needed for demo. |
| **History panel** | `HistoryPanel.jsx` | Replace with simple Undo/Redo buttons. |
| **MiniMap** | `MiniMap.jsx` | Cut — canvas is small enough for the demo. |
| **Stats panel** | `StatsPanel.jsx` | Replace with one tiny line: "X devices · Y links · Z VLANs". |
| **Context menu / advanced popups** | `ContextMenu.jsx`, `ConnectionTypePopup.jsx` | Use simple click + side panel instead. |
| **PDF export, share-link, design brief generation** | `networkArtifacts.js` | Keep PNG + JSON only. |

---

## 4. What to SIMPLIFY (don't delete, just shrink)

| Area | Current state | Simplified for course |
|---|---|---|
| **Toolbar** (`Toolbar.jsx`) | Many modes, many buttons | 4 buttons: **Select**, **Add Device**, **Connect**, **Delete**. |
| **Top bar** (`TopBar.jsx`) | Logo, settings, account, theme, etc. | Logo + project name + Export + Reset. |
| **Left panel** (`LeftPanel.jsx`) | Tabs for templates, library, scenarios | Just the 6-device library (router, switch, PC, server, AP, firewall). |
| **Properties panel** (`PropertiesPanel.jsx`) | Many fields per device | Name, type, IP address, subnet mask, VLAN. That's it. |
| **AI panel** (`AIPanel.jsx`) | Examples, history, refinement, status, provider info | Big text box + "Generate" button + 3 example prompts. |
| **Smart layout / smart engine** (`smartLayout.js`, `smartNetworkEngine.js`) | Many heuristics | Keep only the basic auto-layout (place devices in a clean grid / star). |
| **Stores** (`topologyUiStore.js`, `topologyCanvasStore.js`) | Many UI flags | Strip flags that belong to deleted features. |

---

## 5. How each kept feature maps to the syllabus (use this in the demo)

When presenting, explicitly tie each feature to a course topic — the
instructor will recognize it instantly.

| Course topic (lecture / lab week) | TopologAi feature that demonstrates it |
|---|---|
| **TCP/IP & ISO layers** (Wk 1) | The AI labels each device with its layer role (router=L3, switch=L2, etc.). |
| **DNS / HTTP** (Wk 2–3, lab Wk 4–5) | AI can add a DNS server / web server when prompted. |
| **TCP / UDP** (Wk 4–6) | Property panel shows protocol on a server (e.g., HTTP/TCP, DNS/UDP). |
| **IPv4 addressing & subnets** (Wk 7, lab Wk 9) | Every device shows IP + subnet; AI assigns a sensible plan. |
| **Static & dynamic routing (RIP/OSPF)** (Wk 8–9, lab Wk 10–11) | Routers in the AI output include a "routing protocol" field. |
| **NAT & DHCP** (Wk 7, lab Wk 12) | Edge router is marked as NAT + DHCP source by the AI. |
| **Ethernet, ARP, VLAN** (Wk 10–12, lab Wk 13–14) | VLAN manager + color-coded VLAN view. |
| **Wireless LAN** (Wk 12) | AP device + SSIDs in properties. |
| **Network security / Firewalls** (Wk 13) | Firewall device + a basic ACL field in properties. |

If a slide of the presentation shows that table, the project's value to the
course is obvious in 30 seconds.

---

## 6. Suggested demo script (≈ 4 minutes)

1. **(30 s)** Open empty canvas → say the one-sentence pitch.
2. **(60 s)** In the AI panel, type *"Small office with 15 employees,
   2 departments, guest WiFi, one file server"*. Click Generate.
3. **(45 s)** Topology appears. Point at the router, switch, AP, server, PCs.
   Show that VLANs are color-coded (department A vs department B vs guest).
4. **(45 s)** Click the router → property panel → show IP, subnet, NAT on,
   DHCP on, OSPF on. Say: *"these are the exact concepts from weeks 7–11."*
5. **(30 s)** Open VLAN manager → highlight one VLAN → show isolation.
6. **(30 s)** Add a device manually with the toolbar, connect it with a click,
   then **Export → PNG**. Done.

---

## 7. Team responsibilities (suggested)

| Member | Owns (for the course version) |
|---|---|
| Member A | AI panel + prompt-to-topology demo + script |
| Member B | Canvas, device library, properties panel |
| Member C | VLAN manager + IP addressing display + export |
| Member D | Slides + syllabus mapping (Section 5 of this file) + demo recording |

---

## 8. Technical notes for the simplification PR

- Do **NOT** delete files. Either:
  - Wrap entry points in `if (import.meta.env.VITE_COURSE_BUILD !== 'true')`, or
  - Comment imports in `src/pages/TopologAi.jsx` and remove the JSX usage.
- Add a single env flag `VITE_COURSE_BUILD=true` in `.env.course` so we can
  flip back to the full build by changing one variable.
- Remove unused dependencies from `package.json` only at the very end, after
  confirming the course build works (`@stripe/*`, `three`, `react-leaflet`,
  `recharts`, `embla-carousel-react`, `react-quill`, `jspdf`, `html2canvas`,
  `canvas-confetti`, `vaul`, `input-otp`, `cmdk`, `@hello-pangea/dnd` if not
  used by the kept components).
- Keep all current commits intact on `main`. Do the course slimming on a
  branch like `course/ics343-252` so we can return to `main` after submission.

---

## 9. Out of scope for this document

- The full product roadmap (kept in the original `TopologAi-Prompt-v3-Ultimate.md`).
- Marketing, pricing, payments — these are part of the real product, not the
  course.
- 3D, geographic mapping, advanced AI map-awareness — kept for post-course work.

---

**Bottom line:** for ICS 343, TopologAi is an *AI that draws a network the way
the lectures describe one*. Keep that single idea visible in every screen of
the demo, and remove anything that distracts from it.
