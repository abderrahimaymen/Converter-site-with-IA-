import React, { useState } from 'react';
import XCircleIcon from './icons/XCircleIcon';

interface ExtractionResultModalProps {
  text: string;
  onClose: () => void;
  title?: string;
  extension?: string;
}

const ExtractionResultModal: React.FC<ExtractionResultModalProps> = ({ 
  text, 
  onClose, 
  title = "Extracted Text Result", 
  extension = "txt" 
}) => {
  const [copyFeedback, setCopyFeedback] = useState('');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch (err) {
      setCopyFeedback('Failed to copy');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `result.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="bg-card dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b dark:border-slate-700">
          <h2 className="text-lg font-semibold text-card-foreground dark:text-slate-50">
            {title}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:bg-accent hover:text-primary transition-colors dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-1 p-0 overflow-hidden relative">
            <textarea 
                readOnly
                className="w-full h-full p-4 resize-none bg-transparent text-sm font-mono text-card-foreground dark:text-slate-200 outline-none focus:ring-0"
                value={text}
            ></textarea>
        </main>
        
        <footer className="p-4 border-t dark:border-slate-700 flex justify-end gap-3">
          <span className="self-center text-sm text-green-600 dark:text-green-400 font-medium mr-2">{copyFeedback}</span>
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            Copy to Clipboard
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Download .{extension}
          </button>
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

export default ExtractionResultModal;