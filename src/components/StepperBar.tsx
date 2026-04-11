import { cn } from "@/lib/utils";

interface StepperBarProps {
  steps: string[];
  currentStep: number;
}

const StepperBar = ({ steps, currentStep }: StepperBarProps) => {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full text-xs font-display transition-all duration-300",
            i <= currentStep
              ? "bg-primary text-primary-foreground shadow-elevated"
              : "bg-muted text-muted-foreground"
          )}>
            {i + 1}
          </div>
          <span className={cn(
            "text-xs hidden sm:inline transition-colors",
            i <= currentStep ? "text-foreground" : "text-muted-foreground"
          )}>
            {step}
          </span>
          {i < steps.length - 1 && (
            <div className={cn(
              "w-8 h-0.5 transition-colors",
              i < currentStep ? "bg-primary" : "bg-muted"
            )} />
          )}
        </div>
      ))}
    </div>
  );
};

export default StepperBar;
