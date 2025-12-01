import React from 'react';
import { Check } from 'lucide-react';

const RoutingWizardStepper = ({ steps, currentStep }) => {
  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((step, index) => {
        const isCompleted = step.number < currentStep;
        const isCurrent = step.number === currentStep;
        const isUpcoming = step.number > currentStep;
        
        return (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex items-center">
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium
                ${isCompleted 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : isCurrent 
                    ? 'border-primary text-primary bg-primary/10' 
                    : 'border-muted-foreground/30 text-muted-foreground'
                }
              `}>
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  step.number
                )}
              </div>
              <div className="ml-3">
                <div className={`text-sm font-medium ${
                  isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {step.description}
                </div>
              </div>
            </div>
            
            {index < steps.length - 1 && (
              <div className={`flex-1 h-px mx-4 ${
                isCompleted ? 'bg-primary' : 'bg-muted-foreground/30'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RoutingWizardStepper;