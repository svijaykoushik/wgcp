import { useInput } from '../contexts/InputContext';

const PROMPTS = {
  keyboard: {
    select: { label: 'Select', key: 'Enter' },
    back: { label: 'Back', key: 'Esc' },
    navigate: { label: 'Navigate', key: '← → ↑ ↓' },
    switchTab: { label: 'Switch Tab', key: 'LB / RB' },
  },
  gamepad: {
    select: { label: 'Select', key: 'Ⓐ' },
    back: { label: 'Back', key: 'Ⓑ' },
    navigate: { label: 'Navigate', key: 'D-pad' },
    switchTab: { label: 'Switch Tab', key: 'LB / RB' },
  },
  touch: null,
};

export function InputPrompts() {
  const mode = useInput();
  const prompts = PROMPTS[mode];
  if (!prompts) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex justify-center gap-6 py-3 px-safe-x bg-bg-primary/95 backdrop-blur-md border-t border-card-border text-fluid-xs select-none">
      {Object.entries(prompts).map(([action, item]) => (
        <div key={action} className="flex items-center gap-2 text-text-muted">
          <kbd className="px-2 py-1 bg-bg-secondary border border-card-border rounded-lg text-text-main font-mono text-xs min-w-[2rem] text-center shadow-sm">
            {item.key}
          </kbd>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
export default InputPrompts;
