
import React, { useState, useMemo } from 'react';
import XCircleIcon from './icons/XCircleIcon';
import { marked } from 'marked';

interface ExtractionResultModalProps {
  text: string;
  onClose: () => void;
  title?: string;
  extension?: string;
}

const ExtractionResultModal: React.FC<ExtractionResultModalProps> = ({ 
  text, 
  onClose, 
  title = "Result", 
  extension = "txt" 
}) => {
  const [copyFeedback, setCopyFeedback] = useState('');
  const [viewMode, setViewMode] = useState<'raw' | 'preview'>(extension === 'md' ? 'preview' : 'raw');

  const renderedMarkdown = useMemo(() => {
    return marked.parse(text);
  }, [text]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch (err) {
      setCopyFeedback('Failed');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `result.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-card dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border dark:border-slate-700" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b dark:border-slate-700 bg-card dark:bg-slate-800">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-card-foreground dark:text-slate-100">{title}</h2>
            {extension === 'md' && (
                <div className="flex bg-muted dark:bg-slate-700 p-1 rounded-lg">
                    <button 
                      onClick={() => setViewMode('preview')} 
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                        viewMode === 'preview' 
                        ? 'bg-white text-primary shadow dark:bg-slate-600 dark:text-white' 
                        : 'text-muted-foreground dark:text-slate-400 hover:text-primary dark:hover:text-slate-200'
                      }`}
                    >
                      Preview
                    </button>
                    <button 
                      onClick={() => setViewMode('raw')} 
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                        viewMode === 'raw' 
                        ? 'bg-white text-primary shadow dark:bg-slate-600 dark:text-white' 
                        : 'text-muted-foreground dark:text-slate-400 hover:text-primary dark:hover:text-slate-200'
                      }`}
                    >
                      Raw MD
                    </button>
                </div>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-destructive transition-colors dark:text-slate-400 dark:hover:text-red-400">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-1 overflow-auto bg-white dark:bg-slate-900">
            {viewMode === 'preview' ? (
                <div 
                    className="p-8 prose prose-slate max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
                />
            ) : (
                <textarea 
                    readOnly
                    className="w-full h-full p-4 font-mono text-xs bg-transparent text-slate-900 dark:text-slate-100 outline-none resize-none"
                    value={text}
                />
            )}
        </main>
        
        <footer className="p-4 border-t dark:border-slate-700 flex justify-end gap-3 items-center bg-card dark:bg-slate-800">
          <span className="text-xs text-green-500 font-bold mr-auto">{copyFeedback}</span>
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-primary dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          >
            Close
          </button>
          <button 
            onClick={handleCopy} 
            className="px-4 py-2 text-sm font-bold bg-muted text-primary rounded-lg hover:bg-accent dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors"
          >
            Copy
          </button>
          <button 
            onClick={handleDownload} 
            className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:opacity-90 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white shadow-sm transition-opacity"
          >
            Download .{extension}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ExtractionResultModal;
