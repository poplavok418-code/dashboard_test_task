import { CheckCircle2, CircleAlert } from "lucide-react";
import type { ValidationCheck } from "@/lib/accepted-inputs";

type ValidationChecklistProps = {
  checks: ValidationCheck[];
};

export function ValidationChecklist({ checks }: ValidationChecklistProps) {
  if (checks.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {checks.map((check) => {
        const Icon = check.ok ? CheckCircle2 : CircleAlert;

        return (
          <div
            key={`${check.id}-${check.label}`}
            className="flex min-h-16 gap-3 rounded-md border border-ink/10 bg-white/62 p-3"
          >
            <Icon
              aria-hidden="true"
              className={`mt-0.5 h-4 w-4 shrink-0 ${check.ok ? "text-pine" : "text-berry"}`}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{check.label}</p>
              {check.detail ? (
                <p className="mt-1 text-xs leading-5 text-graphite">{check.detail}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
