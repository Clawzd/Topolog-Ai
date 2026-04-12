// Shared SVG device icons used on canvas and device palette
// Each icon renders inside a viewBox of 0 0 90 50

const DEVICE_ICONS = {
  router: (color) => (
    <g>
      <circle cx="45" cy="22" r="11" fill="none" stroke={color} strokeWidth="1.5"/>
      <circle cx="45" cy="22" r="5" fill={color} opacity="0.6"/>
      {[[34,22,28,22],[56,22,62,22],[45,11,45,5],[45,33,45,39],[37,14,33,10],[53,30,57,34],[53,14,57,10],[37,30,33,34]].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5"/>
      ))}
    </g>
  ),
  switch: (color) => (
    <g>
      <rect x="26" y="16" width="38" height="14" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      {[31,37,43,49,55].map((x, i) => (
        <g key={i}>
          <rect x={x} y="21" width="4" height="4" rx="0.5" fill={color} opacity="0.7"/>
          <line x1={x+2} y1="30" x2={x+2} y2="36" stroke={color} strokeWidth="1" opacity="0.5"/>
        </g>
      ))}
    </g>
  ),
  ap: (color) => (
    <g>
      <path d="M 33 28 A 14 14 0 0 1 57 28" fill="none" stroke={color} strokeWidth="1.5" opacity="0.4"/>
      <path d="M 37 28 A 9 9 0 0 1 53 28" fill="none" stroke={color} strokeWidth="1.5" opacity="0.7"/>
      <path d="M 41 28 A 5 5 0 0 1 49 28" fill="none" stroke={color} strokeWidth="1.5"/>
      <circle cx="45" cy="28" r="2.5" fill={color}/>
      <line x1="45" y1="28" x2="45" y2="38" stroke={color} strokeWidth="1.5"/>
      <line x1="38" y1="38" x2="52" y2="38" stroke={color} strokeWidth="1.5"/>
    </g>
  ),
  server: (color) => (
    <g>
      {[10,21,32].map((y, i) => (
        <g key={i}>
          <rect x="28" y={y} width="34" height="8" rx="2" fill="none" stroke={color} strokeWidth="1.5"/>
          <circle cx="56" cy={y+4} r="2" fill={color} opacity={i===0?0.8:i===1?0.5:0.2}/>
          <rect x="31" y={y+2} width="14" height="4" rx="1" fill={color} opacity="0.12"/>
        </g>
      ))}
    </g>
  ),
  firewall: (color) => (
    <g>
      <path d="M 45 8 L 60 14 L 60 26 Q 60 38 45 44 Q 30 38 30 26 L 30 14 Z" fill={color} opacity="0.12" stroke={color} strokeWidth="1.5"/>
      <path d="M 40 20 Q 45 16 50 20 Q 47 24 50 28 Q 45 32 40 28 Q 43 24 40 20Z" fill={color} opacity="0.5"/>
    </g>
  ),
  cloud: (color) => (
    <g>
      <path d="M 35 32 Q 30 32 30 26 Q 30 20 36 20 Q 37 14 44 14 Q 50 14 52 19 Q 58 19 58 25 Q 58 32 52 32 Z" fill={color} opacity="0.2" stroke={color} strokeWidth="1.5"/>
    </g>
  ),
  pc: (color) => (
    <g>
      <rect x="30" y="10" width="30" height="22" rx="2" fill="none" stroke={color} strokeWidth="1.5"/>
      <rect x="32" y="12" width="26" height="18" rx="1" fill={color} opacity="0.12"/>
      <line x1="40" y1="32" x2="38" y2="38" stroke={color} strokeWidth="1.5"/>
      <line x1="50" y1="32" x2="52" y2="38" stroke={color} strokeWidth="1.5"/>
      <line x1="35" y1="38" x2="55" y2="38" stroke={color} strokeWidth="1.5"/>
    </g>
  ),
  laptop: (color) => (
    <g>
      <rect x="32" y="13" width="26" height="18" rx="2" fill="none" stroke={color} strokeWidth="1.5"/>
      <rect x="34" y="15" width="22" height="14" rx="1" fill={color} opacity="0.12"/>
      <path d="M 27 31 Q 27 38 45 38 Q 63 38 63 31 Z" fill="none" stroke={color} strokeWidth="1.5"/>
    </g>
  ),
  printer: (color) => (
    <g>
      <rect x="31" y="18" width="28" height="16" rx="2" fill="none" stroke={color} strokeWidth="1.5"/>
      <rect x="35" y="12" width="20" height="8" rx="1" fill="none" stroke={color} strokeWidth="1"/>
      <rect x="35" y="34" width="20" height="10" rx="1" fill="none" stroke={color} strokeWidth="1"/>
      <circle cx="54" cy="24" r="2" fill={color} opacity="0.7"/>
    </g>
  ),
  camera: (color) => (
    <g>
      <rect x="28" y="18" width="24" height="16" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      <circle cx="40" cy="26" r="5" fill="none" stroke={color} strokeWidth="1.5"/>
      <circle cx="40" cy="26" r="2" fill={color} opacity="0.6"/>
      <path d="M 52 21 L 62 17 L 62 35 L 52 31 Z" fill="none" stroke={color} strokeWidth="1.5"/>
    </g>
  ),
  nas: (color) => (
    <g>
      <rect x="30" y="10" width="30" height="32" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      {[18,30].map((cy, i) => (
        <g key={i}>
          <circle cx="45" cy={cy} r="4" fill="none" stroke={color} strokeWidth="1"/>
          <circle cx="45" cy={cy} r="1.5" fill={color} opacity="0.6"/>
          <line x1="32" y1={cy+6} x2="38" y2={cy+6} stroke={color} strokeWidth="1" opacity="0.4"/>
        </g>
      ))}
    </g>
  ),
  phone: (color) => (
    <g>
      <rect x="35" y="8" width="20" height="36" rx="4" fill="none" stroke={color} strokeWidth="1.5"/>
      <line x1="38" y1="16" x2="52" y2="16" stroke={color} strokeWidth="1" opacity="0.4"/>
      <circle cx="45" cy="38" r="2.5" fill="none" stroke={color} strokeWidth="1"/>
      <rect x="37" y="18" width="16" height="16" rx="1" fill={color} opacity="0.1"/>
    </g>
  ),
  loadbalancer: (color) => (
    <g>
      <rect x="28" y="18" width="34" height="16" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      <path d="M 45 18 L 35 10 M 45 18 L 55 10" fill="none" stroke={color} strokeWidth="1.2" opacity="0.7"/>
      <path d="M 45 34 L 35 42 M 45 34 L 55 42" fill="none" stroke={color} strokeWidth="1.2" opacity="0.7"/>
      <line x1="36" y1="26" x2="54" y2="26" stroke={color} strokeWidth="1" opacity="0.4" strokeDasharray="3 2"/>
      <text x="45" y="30" textAnchor="middle" fontSize="8" fill={color} fontWeight="bold">LB</text>
    </g>
  ),
  tablet: (color) => (
    <g>
      <rect x="30" y="10" width="22" height="32" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      <rect x="32" y="13" width="18" height="24" rx="1" fill={color} opacity="0.1"/>
      <circle cx="41" cy="39" r="1.5" fill={color} opacity="0.6"/>
      <line x1="50" y1="20" x2="58" y2="20" stroke={color} strokeWidth="1" opacity="0.3"/>
      <line x1="50" y1="26" x2="60" y2="26" stroke={color} strokeWidth="1" opacity="0.3"/>
    </g>
  ),
  iot: (color) => (
    <g>
      <polygon points="45,10 58,18 58,34 45,42 32,34 32,18" fill="none" stroke={color} strokeWidth="1.5"/>
      <circle cx="45" cy="26" r="5" fill="none" stroke={color} strokeWidth="1"/>
      <circle cx="45" cy="26" r="2" fill={color} opacity="0.7"/>
      {[[45,10],[58,18],[58,34],[45,42],[32,34],[32,18]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="2" fill={color} opacity="0.5"/>
      ))}
    </g>
  ),
  pdu: (color) => (
    <g>
      <rect x="30" y="14" width="30" height="24" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      <path d="M 44 14 L 44 8 M 46 14 L 46 8" stroke={color} strokeWidth="1.5" opacity="0.6"/>
      <path d="M 43 22 L 45 18 L 47 22 L 45 22 L 45 30 L 43 26 L 47 26" fill={color} opacity="0.7" stroke="none"/>
      <circle cx="35" cy="32" r="2" fill={color} opacity="0.5"/>
      <circle cx="42" cy="32" r="2" fill={color} opacity="0.5"/>
      <circle cx="55" cy="32" r="2" fill={color} opacity="0.5"/>
    </g>
  ),
  patchpanel: (color) => (
    <g>
      <rect x="24" y="18" width="42" height="16" rx="2" fill="none" stroke={color} strokeWidth="1.5"/>
      {[29,34,39,44,49,54,59].map((x,i) => (
        <g key={i}>
          <rect x={x} y="22" width="3" height="8" rx="0.5" fill={color} opacity="0.5"/>
          <circle cx={x+1.5} cy="21" r="1.5" fill="none" stroke={color} strokeWidth="0.8" opacity="0.7"/>
        </g>
      ))}
    </g>
  ),
  smarttv: (color) => (
    <g>
      <rect x="22" y="12" width="46" height="28" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      <rect x="25" y="15" width="40" height="22" rx="1" fill={color} opacity="0.1"/>
      <line x1="40" y1="40" x2="38" y2="44" stroke={color} strokeWidth="1.5"/>
      <line x1="50" y1="40" x2="52" y2="44" stroke={color} strokeWidth="1.5"/>
      <line x1="35" y1="44" x2="55" y2="44" stroke={color} strokeWidth="1.5"/>
      <circle cx="45" cy="26" r="5" fill="none" stroke={color} strokeWidth="1" opacity="0.5"/>
      <polygon points="43,23 43,29 50,26" fill={color} opacity="0.6"/>
    </g>
  ),
};

export default DEVICE_ICONS;
