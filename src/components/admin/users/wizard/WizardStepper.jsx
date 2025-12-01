import React from 'react';
import { Check } from 'lucide-react';

const WizardStepper = ({ steps, currentStep }) => {
  return (
    <div className="w-full mb-8 px-4 pt-2">
      {/* First row: Circles and connecting lines */}
      <div className="flex items-center justify-center w-full">
        {steps.map((step, index) => (
          <React.Fragment key={step.name}>
            <div className="flex flex-col items-center w-24">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                  currentStep > step.id || currentStep === steps.length && step.id === steps.length
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : currentStep === step.id
                    ? 'border-blue-600'
                    : 'border-gray-300'
                }`}
              >
                {currentStep > step.id || currentStep === steps.length && step.id === steps.length ? (
                  <Check size={16} />
                ) : (
                  <span className={`h-2.5 w-2.5 rounded-full ${currentStep === step.id ? 'bg-blue-600' : 'bg-transparent'}`} />
                )}
              </div>
            </div>
            {/* Connecting line (if not last) */}
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            )}
          </React.Fragment>
        ))}
      </div>
      
      {/* Second row: Labels */}
      <div className="flex items-center justify-center w-full mt-2">
        {steps.map((step, index) => (
          <React.Fragment key={`label-${step.name}`}>
            <div className="flex flex-col items-center w-24">
              <p className={`text-sm text-center leading-tight ${currentStep >= step.id ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                {step.name}
              </p>
            </div>
            {/* Spacer for alignment with connecting lines */}
            {index < steps.length - 1 && (
              <div className="flex-1"></div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default WizardStepper;