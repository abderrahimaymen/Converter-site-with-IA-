
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { PDFDocument, rgb, StandardFonts, PageSizes, degrees } from 'pdf-lib';
import { GoogleGenAI } from "@google/genai";
import { marked } from 'marked';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

import ImageUploader from './components/ImageUploader';
import ImageList from './components/ImageList';
import PdfList from './components/PdfList';
import TxtList from './components/TxtList';
import MixedUploader from './components/MixedUploader';
import MixedFileList from './components/MixedFileList';
import SvgConverterModal from './components/SvgConverterModal';
import ExtractionResultModal from './components/ExtractionResultModal';
import { AppFile } from './types';
import SunIcon from './components/icons/SunIcon';
import MoonIcon from './components/icons/MoonIcon';
import PdfFileIcon from './components/icons/PdfFileIcon';
import FileTextIcon from './components/icons/FileTextIcon';
import TrashIcon from './components/icons/TrashIcon';
import RectangleVerticalIcon from './components/icons/RectangleVerticalIcon';
import RectangleHorizontalIcon from './components/icons/RectangleHorizontalIcon';
import XCircleIcon from './components/icons/XCircleIcon';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type PdfQuality = 'Standard' | 'High';
type Theme = 'light' | 'dark';
type TaskMode = 'new' | 'merge' | 'mergePdfs' | 'textToPdf' | 'extractText' | 'pdfToMd' | 'pptToPdf' | 'pdfToText';
type PageOrientation = 'portrait' | 'landscape';
type ImagesPerPage = 1 | 2 | 4;

interface ParsedSlide {
    id: number;
    text: string[];
    images: string[];
}

interface ParsedPpt {
    filename: string;
    slides: ParsedSlide[];
}

const App: React.FC = () => {
  const [files, setFiles] = useState<AppFile[]>([]);
  const [pdfFiles, setPdfFiles] = useState<AppFile[]>([]);
  const [txtFiles, setTxtFiles] = useState<AppFile[]>([]);
  const [extractFiles, setExtractFiles] = useState<AppFile[]>([]);
  const [pptFiles, setPptFiles] = useState<AppFile[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [extractedTextResult, setExtractedTextResult] = useState<string | null>(null);
  
  // PDF Options
  const [pdfQuality, setPdfQuality] = useState<PdfQuality>('Standard');
  const [taskMode, setTaskMode] = useState<TaskMode>('new');
  const [existingPdfFile, setExistingPdfFile] = useState<File | null>(null);
  const [pageOrientation, setPageOrientation] = useState<PageOrientation>('portrait');
  const [imagesPerPage, setImagesPerPage] = useState<ImagesPerPage>(1);
  const [pageMargins, setPageMargins] = useState(36);
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3);
  const [watermarkImage, setWatermarkImage] = useState<AppFile | null>(null);
  const [watermarkImageOpacity, setWatermarkImageOpacity] = useState(0.15);
  const [outputFilename, setOutputFilename] = useState('');

  const [fileToConvert, setFileToConvert] = useState<AppFile | null>(null);
  const [theme, setTheme] = useState<Theme>('light');

  const printRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleFilesAccepted = useCallback((acceptedFiles: File[]) => {
    const newAppFiles: AppFile[] = [];
    acceptedFiles.forEach(file => {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) return;
      if (file.size > MAX_FILE_SIZE_BYTES) return;
      newAppFiles.push({ id: `${file.name}-${Date.now()}-${Math.random()}`, file, previewUrl: URL.createObjectURL(file) });
    });
    setFiles(prev => [...prev, ...newAppFiles]);
  }, []);

  const handleExtractFilesAccepted = useCallback((acceptedFiles: File[]) => {
    const newAppFiles: AppFile[] = [];
    acceptedFiles.forEach(file => {
      const isImage = SUPPORTED_IMAGE_TYPES.includes(file.type);
      const isPdf = file.type === 'application/pdf';
      if (!isImage && !isPdf) return;
      newAppFiles.push({ id: `${file.name}-${Date.now()}-${Math.random()}`, file, previewUrl: isImage ? URL.createObjectURL(file) : '' });
    });
    setExtractFiles(prev => [...prev, ...newAppFiles]);
  }, []);

  const handlePptFilesAccepted = useCallback((acceptedFiles: File[]) => {
      const newAppFiles: AppFile[] = [];
      acceptedFiles.forEach(file => {
          if (!file.name.endsWith('.pptx')) return;
          newAppFiles.push({ id: `${file.name}-${Date.now()}-${Math.random()}`, file, previewUrl: '' });
      });
      setPptFiles(prev => [...prev, ...newAppFiles]);
  }, []);

  const handlePdfFilesAccepted = useCallback((acceptedFiles: File[]) => {
    const newAppFiles: AppFile[] = [];
    acceptedFiles.forEach(file => {
      if (file.type !== 'application/pdf') return;
      newAppFiles.push({ id: `${file.name}-${Date.now()}-${Math.random()}`, file, previewUrl: '' });
    });
    setPdfFiles(prev => [...prev, ...newAppFiles]);
  }, []);

  const handleTxtFilesAccepted = useCallback((acceptedFiles: File[]) => {
    const newAppFiles: AppFile[] = [];
    acceptedFiles.forEach(file => {
        const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
        const isMd = file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.markdown');
        if (!isTxt && !isMd) return;
        newAppFiles.push({ id: `${file.name}-${Date.now()}-${Math.random()}`, file, previewUrl: '' });
    });
    setTxtFiles(prev => [...prev, ...newAppFiles]);
  }, []);

  const handleRemoveFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));
  const handleRemoveExtractFile = (id: string) => setExtractFiles(prev => prev.filter(f => f.id !== id));
  const handleRemovePptFile = (id: string) => setPptFiles(prev => prev.filter(f => f.id !== id));
  const handleRemovePdfFile = (id: string) => setPdfFiles(prev => prev.filter(f => f.id !== id));
  const handleRemoveTxtFile = (id: string) => setTxtFiles(prev => prev.filter(f => f.id !== id));

  const handleConvertToSvg = (id: string) => {
    const file = files.find(f => f.id === id);
    if (file) setFileToConvert(file);
  };

  const handleClearAll = () => setFiles([]);
  const handleClearAllExtract = () => setExtractFiles([]);
  const handleClearAllPpt = () => setPptFiles([]);
  const handleClearAllPdfs = () => setPdfFiles([]);
  const handleClearAllTxts = () => setTxtFiles([]);

  const fileToBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
  };

  const renderPdfPagesToImages = async (file: File): Promise<string[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageImages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context!, viewport: viewport, canvas: canvas }).promise;
        pageImages.push(canvas.toDataURL('image/png').split(',')[1]);
    }
    return pageImages;
  };

  const handleAiTask = async () => {
    if (extractFiles.length === 0) return;
    const isMarkdownTask = taskMode === 'pdfToMd';
    const isPdfToTextTask = taskMode === 'pdfToText';
    setIsGenerating(true);
    setProgress(0);
    setProgressMessage('Processing documents...');

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const results: string[] = [];
        for (let i = 0; i < extractFiles.length; i++) {
            const file = extractFiles[i].file;
            setProgressMessage(`Analyzing: ${file.name}...`);
            let parts: any[] = [];
            if (file.type === 'application/pdf' && isMarkdownTask) {
                const images = await renderPdfPagesToImages(file);
                parts = images.map(img => ({ inlineData: { mimeType: 'image/png', data: img } }));
            } else {
                const base64Data = (await fileToBase64(file)).split(',')[1];
                parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
            }
            const prompt = isMarkdownTask
                ? "Convert this document into high-fidelity Markdown. Extract all text, preserve headers, lists, and CRITICAL: convert any visible tables into valid Markdown tables. If there are images, diagrams, or charts, add a descriptive placeholder block beginning with `> ![Visual Element: ...]`."
                : "Extract all text from this document. Preserve the original structure.";

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { parts: [...parts, { text: prompt }] }
            });
            results.push(response.text || '');
            setProgress(((i + 1) / extractFiles.length) * 100);
        }
        setExtractedTextResult(results.join('\n\n'));
        setIsGenerating(false);
    } catch (e: any) {
        setError(`Failed: ${e.message}`);
        setIsGenerating(false);
    }
  };

  const generatePdf = async () => {
    if (['extractText', 'pdfToMd', 'pdfToText'].includes(taskMode)) {
        handleAiTask();
        return;
    }
    
    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setProgressMessage('Generating PDF...');
    
    try {
        let pdfDoc = await PDFDocument.create();
        
        if (taskMode === 'textToPdf') {
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            if (txtFiles.length === 0) throw new Error("No text files selected.");
            
            for (let i = 0; i < txtFiles.length; i++) {
                const file = txtFiles[i].file;
                setProgressMessage(`Processing ${file.name}...`);
                const text = await file.text();
                
                // Add page and draw text
                const page = pdfDoc.addPage(PageSizes.A4);
                const { width, height } = page.getSize();
                const margin = 50;
                
                page.drawText(text, {
                    x: margin,
                    y: height - margin,
                    size: 11,
                    font: font,
                    maxWidth: width - (margin * 2),
                    lineHeight: 14,
                });
                setProgress(((i + 1) / txtFiles.length) * 100);
            }
        } else if (taskMode === 'mergePdfs') {
            if (pdfFiles.length === 0) throw new Error("No PDF files selected.");
            for (let i = 0; i < pdfFiles.length; i++) {
                const file = pdfFiles[i].file;
                setProgressMessage(`Merging ${file.name}...`);
                const srcDoc = await PDFDocument.load(await file.arrayBuffer());
                const copiedPages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
                copiedPages.forEach((page) => pdfDoc.addPage(page));
                setProgress(((i + 1) / pdfFiles.length) * 100);
            }
        } else if (taskMode === 'new') {
            // Default: Image to PDF
            if (files.length === 0) throw new Error("No images selected.");
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i].file;
                setProgressMessage(`Processing ${file.name}...`);
                
                const arrayBuffer = await file.arrayBuffer();
                let image;
                try {
                    if (file.type === 'image/jpeg') image = await pdfDoc.embedJpg(arrayBuffer);
                    else if (file.type === 'image/png') image = await pdfDoc.embedPng(arrayBuffer);
                    else continue;
                } catch (e) {
                    console.error(`Failed to embed image ${file.name}`, e);
                    continue;
                }

                const page = pdfDoc.addPage(PageSizes.A4);
                const { width, height } = page.getSize();
                
                const margin = pageMargins; 
                const availableWidth = width - (margin * 2);
                const availableHeight = height - (margin * 2);
                const imgDims = image.scale(1);
                
                const scale = Math.min(
                    availableWidth / imgDims.width,
                    availableHeight / imgDims.height
                );
                
                const displayWidth = imgDims.width * scale;
                const displayHeight = imgDims.height * scale;
                
                page.drawImage(image, {
                    x: (width - displayWidth) / 2,
                    y: (height - displayHeight) / 2,
                    width: displayWidth,
                    height: displayHeight,
                });
                
                setProgress(((i + 1) / files.length) * 100);
            }
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = outputFilename || `document-${Date.now()}.pdf`;
        link.click();
        setIsGenerating(false);
    } catch (e: any) {
        setError(e.message || "Generation failed.");
        setIsGenerating(false);
    }
  };

  const isAiMode = useMemo(() => ['extractText', 'pdfToMd', 'pdfToText'].includes(taskMode), [taskMode]);

  const OptionGroup: React.FC<{title: string, children: React.ReactNode, disabled?: boolean}> = ({title, children, disabled}) => (
    <div className={`space-y-2 rounded-lg border dark:border-slate-700 p-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h4 className="text-sm font-semibold text-muted-foreground dark:text-slate-300">{title}</h4>
        {children}
    </div>
  );

  return (
    <div className="bg-secondary min-h-screen font-sans text-primary dark:text-slate-100 dark:bg-slate-900 transition-colors">
      <div className="container mx-auto px-4 py-8 md:py-16 max-w-4xl">
        <header className="text-center mb-10 relative">
            <div className="flex justify-center items-center">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary-foreground bg-primary dark:bg-slate-800 dark:text-slate-50 rounded-lg py-2 px-4 inline-block">
                    Image to PDF Converter
                </h1>
                <button onClick={toggleTheme} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full text-muted-foreground hover:bg-accent dark:text-slate-400 dark:hover:bg-slate-700 transition-colors">
                    {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                </button>
            </div>
            <p className="mt-4 text-lg text-muted-foreground dark:text-slate-400 max-w-2xl mx-auto">
                Easily merge your images or text files into a single PDF, extract text, or convert between formats.
            </p>
        </header>

        <main className="space-y-8">
            <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50 border dark:border-slate-700">
                <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">1. Upload Files</h2>
                {isAiMode ? <MixedUploader onFilesAccepted={handleExtractFilesAccepted} /> : 
                 (taskMode === 'mergePdfs' ? <MixedUploader onFilesAccepted={handlePdfFilesAccepted} /> : 
                  (taskMode === 'textToPdf' ? <MixedUploader onFilesAccepted={handleTxtFilesAccepted} /> : 
                   (taskMode === 'pptToPdf' ? <MixedUploader onFilesAccepted={handlePptFilesAccepted} acceptPpt={true} /> : 
                    <ImageUploader onFilesAccepted={handleFilesAccepted} />)))}
            </div>

            <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50 border dark:border-slate-700">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">2. Arrange Files</h2>
                    <button onClick={() => { handleClearAll(); handleClearAllExtract(); handleClearAllPpt(); handleClearAllPdfs(); handleClearAllTxts(); }} className="text-sm text-destructive font-medium hover:underline">Clear All</button>
                </div>
                {isAiMode ? <MixedFileList files={extractFiles} onRemoveFile={handleRemoveExtractFile} onReorderFiles={setExtractFiles} /> : 
                 (taskMode === 'mergePdfs' ? <PdfList files={pdfFiles} onRemoveFile={handleRemovePdfFile} onReorderFiles={setPdfFiles} /> : 
                  (taskMode === 'textToPdf' ? <TxtList files={txtFiles} onRemoveFile={handleRemoveTxtFile} onReorderFiles={setTxtFiles} /> : 
                   (taskMode === 'pptToPdf' ? <MixedFileList files={pptFiles} onRemoveFile={handleRemovePptFile} onReorderFiles={setPptFiles} /> : 
                    <ImageList files={files} onRemoveFile={handleRemoveFile} onReorderFiles={setFiles} onConvertToSvg={handleConvertToSvg} />)))}
            </div>

            <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50 border dark:border-slate-700">
                <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50 text-center mb-2">3. Process Files</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                      <OptionGroup title="Task">
                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted dark:bg-slate-700/50 p-1">
                          {[
                            {id:'new', label:'New PDF'}, {id:'textToPdf', label:'Text/MD to PDF'},
                            {id:'merge', label:'Merge w/ PDF'}, {id:'mergePdfs', label:'Merge PDFs'},
                            {id:'extractText', label:'Extract Text'}, {id:'pdfToMd', label:'PDF to Markdown'},
                            {id:'pptToPdf', label:'PPT to PDF'}, {id:'pdfToText', label:'PDF to Text'}
                          ].map(mode => (
                            <button key={mode.id} onClick={() => setTaskMode(mode.id as TaskMode)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${taskMode === mode.id ? 'bg-primary text-white shadow dark:bg-slate-50 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300 hover:bg-background/50 dark:hover:bg-slate-600'}`}>{mode.label}</button>
                          ))}
                        </div>
                      </OptionGroup>
                      <OptionGroup title="Layout" disabled={isAiMode || taskMode === 'mergePdfs'}>
                          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted dark:bg-slate-700/50 p-1">
                              <button onClick={() => setPageOrientation('portrait')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${pageOrientation === 'portrait' ? 'bg-primary text-white shadow dark:bg-slate-50 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300 hover:bg-background/50 dark:hover:bg-slate-600'}`}>Portrait</button>
                              <button onClick={() => setPageOrientation('landscape')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${pageOrientation === 'landscape' ? 'bg-primary text-white shadow dark:bg-slate-50 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300 hover:bg-background/50 dark:hover:bg-slate-600'}`}>Landscape</button>
                          </div>
                      </OptionGroup>
                  </div>
                  <div className="space-y-4">
                       <OptionGroup title="Styling" disabled={isAiMode}>
                            <div className="flex items-center justify-between px-1"><label className="text-xs font-bold text-slate-700 dark:text-slate-300">Background</label><input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border dark:border-slate-600" /></div>
                       </OptionGroup>
                       <OptionGroup title="Quality" disabled={isAiMode}>
                          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted dark:bg-slate-700/50 p-1">
                             <button onClick={() => setPdfQuality('Standard')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${pdfQuality === 'Standard' ? 'bg-primary text-white shadow dark:bg-slate-50 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300 hover:bg-background/50 dark:hover:bg-slate-600'}`}>Standard</button>
                             <button onClick={() => setPdfQuality('High')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${pdfQuality === 'High' ? 'bg-primary text-white shadow dark:bg-slate-50 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300 hover:bg-background/50 dark:hover:bg-slate-600'}`}>High</button>
                          </div>
                       </OptionGroup>
                  </div>
                </div>
                <div className="pt-4">
                  <button onClick={generatePdf} disabled={isGenerating} className="w-full px-6 py-4 text-lg font-bold text-white bg-primary rounded-xl shadow-lg hover:opacity-90 disabled:bg-muted transition-all dark:bg-slate-50 dark:text-slate-900">
                      {isGenerating ? 'Processing...' : 'Generate Result'}
                  </button>
                </div>
                {isGenerating && (
                  <div className="w-full text-center mt-4">
                    <div className="w-full bg-muted h-2 rounded-full overflow-hidden"><div className="bg-primary h-full transition-all" style={{ width: `${progress}%` }}></div></div>
                    <p className="text-xs text-muted-foreground mt-2">{progressMessage} ({Math.round(progress)}%)</p>
                  </div>
                )}
            </div>
        </main>
        <footer className="text-center mt-12 pb-8"><p className="text-xs text-muted-foreground">Powered by Smart Document Studio & Gemini.</p></footer>
      </div>

      <div ref={printRef} className="absolute top-0 left-[-9999px] bg-white text-black p-12 overflow-x-visible" style={{ minWidth: '794px', width: '794px', color: '#000', backgroundColor: '#fff' }}></div>
      
      {fileToConvert && <SvgConverterModal file={fileToConvert} onClose={() => setFileToConvert(null)} />}
      {extractedTextResult && (
        <ExtractionResultModal text={extractedTextResult} onClose={() => setExtractedTextResult(null)} title={taskMode === 'pdfToMd' ? 'Markdown Digitization' : 'Text Result'} extension={taskMode === 'pdfToMd' ? 'md' : 'txt'} />
      )}
    </div>
  );
};

export default App;
