import React from 'react';
import { Check, Circle } from 'lucide-react';

const Stepper = ({ currentStep, steps = ['Color Details', 'Printer Details', 'Job Details'] }) => {
  return (
    <div className="flex items-center justify-center w-full mb-8">
      {steps.map((step, index) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                currentStep > index + 1 || currentStep === steps.length && index + 1 === steps.length
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : currentStep === index + 1
                  ? 'border-blue-600'
                  : 'border-gray-300'
              }`}
            >
              {currentStep > index + 1 || currentStep === steps.length && index + 1 === steps.length ? <Check size={16} /> : <Circle size={12} className={currentStep === index + 1 ? 'text-blue-600' : 'text-gray-300'} fill={currentStep === index + 1 ? 'currentColor' : 'transparent'} />}
            </div>
            <p className={`mt-2 text-sm ${currentStep >= index + 1 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{step}</p>
          </div>
          {index < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-4 ${currentStep > index + 1 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default Stepper;