import { X } from 'lucide-react';

const STEPS = [
  { title: 'Describe your space', body: 'Use the AI panel to generate a topology from a short description of rooms and gear.' },
  { title: 'Drag devices', body: 'Pull switches, APs, and endpoints from the left palette onto the canvas.' },
  { title: 'Zones & barriers', body: 'Draw rooms for smart zones, use Barrier mode (B) for walls that affect WiFi.' },
  { title: 'Network intelligence', body: 'Open the intelligence panel for scores, findings, and deterministic checks.' },
  { title: 'Simulate failures', body: 'Select a device and press F to see downstream impact, or use toolbar toggles.' },
];

export default function OnboardingTour({ step, onStep, onDismiss }) {
  if (step == null || step < 0 || step >= STEPS.length) return null;
  const s = STEPS[step];
  return (
    <div className="fixed inset-0 z-[95] pointer-events-none flex items-end justify-center pb-8 px-4">
      <div
        className="pointer-events-auto w-full max-w-sm rounded-xl border border-primary/40 bg-card/95 backdrop-blur-md shadow-2xl shadow-primary/10 p-4"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">Tour {step + 1}/{STEPS.length}</div>
            <h3 className="text-sm font-semibold text-foreground mt-1">{s.title}</h3>
          </div>
          <button type="button" onClick={onDismiss} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
        <div className="flex justify-between mt-4 gap-2">
          <button type="button" onClick={onDismiss} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">
            Skip tour
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => onStep(step - 1)} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted">
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (step < STEPS.length - 1 ? onStep(step + 1) : onDismiss())}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
            >
              {step < STEPS.length - 1 ? 'Next' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
