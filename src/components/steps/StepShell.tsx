import type { ReactNode } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';

interface StepShellProps {
  index: number;
  title: string;
  subtitle?: string;
  complete: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export default function StepShell({ index, title, subtitle, complete, expanded, onToggle, children }: StepShellProps) {
  return (
    <section className={`step-card${expanded ? ' expanded' : ''}${complete ? ' complete' : ''}`}>
      <button className="step-header" onClick={onToggle}>
        <span className="step-index">{complete ? <CheckCircle2 size={18} /> : index}</span>
        <span className="step-title"><b>{title}</b>{subtitle && <small>{subtitle}</small>}</span>
        <ChevronDown size={18} className="step-chevron" />
      </button>
      {expanded && <div className="step-body">{children}</div>}
    </section>
  );
}
