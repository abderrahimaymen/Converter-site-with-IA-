import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppFile } from '../types';
import Spinner from './Spinner';

declare global {
  interface Window {
    ImageTracer: any;
  }
}

interface SvgConverterModalProps {
  file: AppFile;
  onClose: () => void;
}

const SvgConverterModal: React.FC<SvgConverterModalProps> = ({ file, onClose }) => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [options, setOptions] = useState({
    numberofcolors: 16,
    pathomit: 8,
    ltres: 1,
    qtres: 1,
  });

  const convertImage = useCallback(() => {
    if (!file || typeof window.ImageTracer === 'undefined') {
        console.error("ImageTracer is not loaded.");
        return;
    };

    setIsProcessing(true);
    
    setTimeout(() => {
        const tracerOptions = {
            ...options,
            mincolorratio: 0, 
            colorquantcycles: 5,
            scale: 2,
            colorsampling: 2, // 1 is random, 2 is deterministic
        };

        window.ImageTracer.imageToSVG(
            file.previewUrl,
            (svgString: string) => {
                setSvgContent(svgString);
                setIsProcessing(false);
            },
            tracerOptions
        );
    }, 100);

  }, [file.previewUrl, options]);

  useEffect(() => {
    convertImage();
  }, [convertImage]);

  const handleDownload = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const originalName = file.file.name.split('.').slice(0, -1).join('.');
    a.download = `${originalName}-vector.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleOptionChange = (key: keyof typeof options, value: number) => {
    setOptions(prev => ({...prev, [key]: value}));
  };
  
  const svgDataUrl = useMemo(() => {
    if (!svgContent) return '';
    return `data:image/svg+xml;base64,${btoa(svgContent)}`;
  }, [svgContent]);

  const SliderControl: React.FC<{
    label: string;
    id: keyof typeof options;
    min: number;
    max: number;
    step: number;
    value: number;
  }> = ({ label, id, min, max, step, value }) => (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between items-center">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground dark:text-slate-400 whitespace-nowrap">{label}</label>
        <span className="text-xs font-semibold text-primary dark:text-slate-200 w-8 text-center">
          {value.toFixed(id === 'ltres' || id === 'qtres' ? 1 : 0)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => handleOptionChange(id, parseFloat(e.target.value))}
        className="w-full h-2 bg-muted dark:bg-slate-600 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="svg-converter-title"
    >
      <div 
        className="bg-card dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b dark:border-slate-700">
          <h2 id="svg-converter-title" className="text-lg font-semibold text-card-foreground dark:text-slate-50">
            Convert to SVG: <span className="font-normal truncate">{file.file.name}</span>
          </h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:bg-accent hover:text-primary transition-colors dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </header>

        <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
            <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-secondary dark:bg-slate-900 dark:border-slate-700">
                <h3 className="text-sm font-medium text-muted-foreground dark:text-slate-400 mb-2">Original Image</h3>
                <img src={file.previewUrl} alt="Original" className="max-w-full max-h-80 object-contain rounded-md" />
            </div>
            <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-secondary dark:bg-slate-900 dark:border-slate-700 relative">
                <h3 className="text-sm font-medium text-muted-foreground dark:text-slate-400 mb-2">SVG Preview</h3>
                {isProcessing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/80 dark:bg-slate-900/80 rounded-md">
                        <Spinner />
                        <p className="mt-2 text-sm text-muted-foreground dark:text-slate-400">Vectorizing...</p>
                    </div>
                )}
                {svgContent && !isProcessing && (
                     <img src={svgDataUrl} alt="SVG Preview" className="max-w-full max-h-80 object-contain rounded-md" />
                )}
            </div>
        </main>
        
        <footer className="p-4 border-t dark:border-slate-700 flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 items-center">
            <SliderControl label="Color Palette" id="numberofcolors" min={2} max={64} step={1} value={options.numberofcolors} />
            <SliderControl label="Line Threshold" id="ltres" min={0} max={5} step={0.1} value={options.ltres} />
            <SliderControl label="Curve Threshold" id="qtres" min={0} max={5} step={0.1} value={options.qtres} />
            <SliderControl label="Path Omit" id="pathomit" min={0} max={20} step={1} value={options.pathomit} />
          </div>
          <div className="flex justify-end">
            <button
                onClick={handleDownload}
                disabled={isProcessing || !svgContent}
                className="w-full sm:w-auto px-6 py-2 text-base font-semibold text-primary-foreground bg-primary rounded-lg shadow-sm hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
            >
                Download SVG
            </button>
          </div>
        </footer>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-slide-up { animation: slide-up 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default SvgConverterModal;