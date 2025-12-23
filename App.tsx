import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { PDFDocument, rgb, StandardFonts, PageSizes, degrees } from 'pdf-lib';
import { GoogleGenAI } from "@google/genai";
import { marked } from 'marked';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
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
type FontType = 'Courier' | 'Helvetica' | 'Times';

interface ParsedSlide {
    id: number;
    text: string[];
    images: string[]; // Blob URLs
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
  const [pageMargins, setPageMargins] = useState(36); // 0.5 inch in points
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3);
  const [watermarkImage, setWatermarkImage] = useState<AppFile | null>(null);
  const [watermarkImageOpacity, setWatermarkImageOpacity] = useState(0.15);
  const [outputFilename, setOutputFilename] = useState('');

  // Text Options
  const [fontType, setFontType] = useState<FontType>('Courier');
  const [fontSize, setFontSize] = useState(12);

  const [fileToConvert, setFileToConvert] = useState<AppFile | null>(null);
  const [theme, setTheme] = useState<Theme>('light');

  // Hidden Ref for rendering Markdown/PPT
  const printRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const handleFilesAccepted = useCallback((acceptedFiles: File[]) => {
    const newAppFiles: AppFile[] = [];
    const validationErrors: string[] = [];

    acceptedFiles.forEach(file => {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        validationErrors.push(`'${file.name}' (unsupported format)`);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        validationErrors.push(`'${file.name}' (exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit)`);
        return;
      }
      
      newAppFiles.push({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });
    
    setFiles(prev => [...prev, ...newAppFiles]);

    if (validationErrors.length > 0) {
      setError(`Skipped ${validationErrors.length} file(s): ${validationErrors.join(', ')}.`);
    } else {
      setError(null);
    }
  }, []);

  const handleExtractFilesAccepted = useCallback((acceptedFiles: File[]) => {
    const newAppFiles: AppFile[] = [];
    const validationErrors: string[] = [];

    acceptedFiles.forEach(file => {
      const isImage = SUPPORTED_IMAGE_TYPES.includes(file.type);
      const isPdf = file.type === 'application/pdf';

      if (!isImage && !isPdf) {
        validationErrors.push(`'${file.name}' (unsupported format)`);
        return;
      }

      if (file.size > 20 * 1024 * 1024) { // 20MB limit for Gemini
        validationErrors.push(`'${file.name}' (exceeds 20MB limit)`);
        return;
      }
      
      newAppFiles.push({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : '',
      });
    });
    
    setExtractFiles(prev => [...prev, ...newAppFiles]);

    if (validationErrors.length > 0) {
      setError(`Skipped ${validationErrors.length} file(s): ${validationErrors.join(', ')}.`);
    } else {
      setError(null);
    }
  }, []);

  const handlePptFilesAccepted = useCallback((acceptedFiles: File[]) => {
      const newAppFiles: AppFile[] = [];
      const validationErrors: string[] = [];

      acceptedFiles.forEach(file => {
          if (!file.name.endsWith('.pptx')) {
               validationErrors.push(`'${file.name}' (must be .pptx)`);
               return;
          }
           if (file.size > 20 * 1024 * 1024) {
               validationErrors.push(`'${file.name}' (exceeds 20MB limit)`);
               return;
          }
          newAppFiles.push({
              id: `${file.name}-${file.lastModified}-${Math.random()}`,
              file,
              previewUrl: '', // No preview for PPT
          });
      });

      setPptFiles(prev => [...prev, ...newAppFiles]);
      if (validationErrors.length > 0) {
          setError(`Skipped ${validationErrors.length} file(s): ${validationErrors.join(', ')}.`);
      } else {
          setError(null);
      }
  }, []);

  const handlePdfFilesAccepted = useCallback((acceptedFiles: File[]) => {
    const newAppFiles: AppFile[] = [];
    const validationErrors: string[] = [];

    acceptedFiles.forEach(file => {
      if (file.type !== 'application/pdf') {
        validationErrors.push(`'${file.name}' (not a PDF)`);
        return;
      }
      
      newAppFiles.push({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: '', // Not used for PDFs
      });
    });
    
    setPdfFiles(prev => [...prev, ...newAppFiles]);

    if (validationErrors.length > 0) {
      setError(`Skipped ${validationErrors.length} file(s): ${validationErrors.join(', ')}.`);
    } else {
      setError(null);
    }
  }, []);

  const handleTxtFilesAccepted = useCallback((acceptedFiles: File[]) => {
    const newAppFiles: AppFile[] = [];
    const validationErrors: string[] = [];

    acceptedFiles.forEach(file => {
        // Basic check for text file type or extension or markdown
        const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
        const isMd = file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.markdown');

        if (!isTxt && !isMd) {
            validationErrors.push(`'${file.name}' (not a text or markdown file)`);
            return;
        }

        newAppFiles.push({
            id: `${file.name}-${file.lastModified}-${Math.random()}`,
            file,
            previewUrl: '', // Not used for Txt
        });
    });

    setTxtFiles(prev => [...prev, ...newAppFiles]);

    if (validationErrors.length > 0) {
        setError(`Skipped ${validationErrors.length} file(s): ${validationErrors.join(', ')}.`);
    } else {
        setError(null);
    }
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const handleRemoveExtractFile = useCallback((id: string) => {
    setExtractFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove && fileToRemove.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const handleRemovePptFile = useCallback((id: string) => {
     setPptFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleRemovePdfFile = useCallback((id: string) => {
    setPdfFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleRemoveTxtFile = useCallback((id: string) => {
    setTxtFiles(prev => prev.filter(f => f.id !== id));
  }, []);
  
  const handleClearAll = useCallback(() => {
    if (window.confirm('Are you sure you want to remove all images? This action cannot be undone.')) {
        files.forEach(appFile => URL.revokeObjectURL(appFile.previewUrl));
        setFiles([]);
        setError(null);
    }
  }, [files]);

  const handleClearAllExtract = useCallback(() => {
    if (window.confirm('Are you sure you want to remove all files?')) {
        extractFiles.forEach(appFile => {
            if (appFile.previewUrl) URL.revokeObjectURL(appFile.previewUrl);
        });
        setExtractFiles([]);
        setError(null);
    }
  }, [extractFiles]);

  const handleClearAllPpt = useCallback(() => {
      if (window.confirm('Are you sure?')) {
          setPptFiles([]);
          setError(null);
      }
  }, []);

  const handleClearAllPdfs = useCallback(() => {
    if (window.confirm('Are you sure you want to remove all PDF files? This action cannot be undone.')) {
        setPdfFiles([]);
        setError(null);
    }
  }, []);

  const handleClearAllTxts = useCallback(() => {
    if (window.confirm('Are you sure you want to remove all text files? This action cannot be undone.')) {
        setTxtFiles([]);
        setError(null);
    }
  }, []);


  const handleReorderFiles = useCallback((reorderedFiles: AppFile[]) => {
    setFiles(reorderedFiles);
  }, []);

  const handleReorderExtractFiles = useCallback((reorderedFiles: AppFile[]) => {
    setExtractFiles(reorderedFiles);
  }, []);

  const handleReorderPptFiles = useCallback((reorderedFiles: AppFile[]) => {
      setPptFiles(reorderedFiles);
  }, []);

  const handleReorderPdfFiles = useCallback((reorderedFiles: AppFile[]) => {
    setPdfFiles(reorderedFiles);
  }, []);

  const handleReorderTxtFiles = useCallback((reorderedFiles: AppFile[]) => {
    setTxtFiles(reorderedFiles);
  }, []);
  
  const handleConvertToSvg = useCallback((id: string) => {
    const file = files.find(f => f.id === id);
    if (file) {
        setFileToConvert(file);
    }
  }, [files]);
  
  const handleCloseConverter = () => {
    setFileToConvert(null);
  };
  
  const handleExistingPdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (file.type !== 'application/pdf') {
            setError('Please select a valid PDF file.');
            return;
        }
        setExistingPdfFile(file);
        setError(null);
    }
    e.target.value = '';
  };

  const handleWatermarkImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
            setError('Unsupported watermark image format. Please use PNG, JPG, or WEBP.');
            return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES / 2) { // 5MB limit for watermark
            setError(`Watermark image exceeds 5MB limit.`);
            return;
        }
        if (watermarkImage) {
            URL.revokeObjectURL(watermarkImage.previewUrl);
        }
        setWatermarkImage({
            id: `watermark-${Date.now()}`,
            file,
            previewUrl: URL.createObjectURL(file),
        });
        setError(null);
    }
    e.target.value = '';
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
        }
      : { r: 1, g: 1, b: 1 }; // Default to white on error
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
  };

  const parsePptx = async (file: File): Promise<ParsedPpt> => {
      try {
        const zip = await JSZip.loadAsync(file);
        const slides: ParsedSlide[] = [];
        
        // Regex to match slideX.xml
        const slideRegex = /^ppt\/slides\/slide(\d+)\.xml$/;
        
        const fileNames = Object.keys(zip.files).filter(name => slideRegex.test(name));
        // Sort naturally
        fileNames.sort((a, b) => {
            const numA = parseInt(a.match(slideRegex)![1]);
            const numB = parseInt(b.match(slideRegex)![1]);
            return numA - numB;
        });
  
        for (let i = 0; i < fileNames.length; i++) {
            const filename = fileNames[i];
            const slideXml = await zip.file(filename)!.async('string');
            const slideNum = parseInt(filename.match(slideRegex)![1]);
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(slideXml, 'text/xml');
            
            // Extract text robustly by checking localName for 't' (text) tags
            const allElements = doc.getElementsByTagName('*');
            const texts: string[] = [];
            
            for(let k=0; k < allElements.length; k++) {
                if (allElements[k].localName === 't') {
                     texts.push(allElements[k].textContent || '');
                }
            }
            
            // Extract images
            const blips: Element[] = [];
            for(let k=0; k < allElements.length; k++) {
                if (allElements[k].localName === 'blip') {
                     blips.push(allElements[k]);
                }
            }

            const imageBlobs: string[] = [];
            
            if (blips.length > 0) {
                // 2. Load relationships
                const relsName = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
                const relsFile = zip.file(relsName);
                if (relsFile) {
                    const relsXml = await relsFile.async('string');
                    const relsDoc = parser.parseFromString(relsXml, 'text/xml');
                    const relationships = relsDoc.getElementsByTagName('Relationship');
                    
                    const relMap: Record<string, string> = {};
                    for (let k = 0; k < relationships.length; k++) {
                        const id = relationships[k].getAttribute('Id');
                        const target = relationships[k].getAttribute('Target');
                        if (id && target) relMap[id] = target;
                    }
                    
                    for (let j = 0; j < blips.length; j++) {
                        // Try different attribute names for embed ID
                        const embedId = blips[j].getAttribute('r:embed') || blips[j].getAttribute('embed');
                        
                        if (embedId && relMap[embedId]) {
                            let targetPath = relMap[embedId];
                            // Path normalization
                            targetPath = targetPath.replace('../', 'ppt/');
                            // Handle cases where path doesn't start with ppt/ if it was in same dir (rare for media)
                            if (!targetPath.startsWith('ppt/')) {
                                if (targetPath.startsWith('media/')) targetPath = 'ppt/' + targetPath;
                            }
                            
                            const imgFile = zip.file(targetPath);
                            if (imgFile) {
                                const imgBlob = await imgFile.async('blob');
                                imageBlobs.push(URL.createObjectURL(imgBlob));
                            }
                        }
                    }
                }
            }
            
            slides.push({
                id: slideNum,
                text: texts,
                images: imageBlobs
            });
        }
        
        return { filename: file.name, slides };
      } catch (err: any) {
          console.error("Error parsing PPTX:", err);
          throw new Error(`Failed to parse ${file.name}: ${err.message}`);
      }
  };

  const handleAiTask = async () => {
    if (extractFiles.length === 0) {
        setError('Please upload at least one file.');
        return;
    }

    const isMarkdownTask = taskMode === 'pdfToMd';
    const isPdfToTextTask = taskMode === 'pdfToText';
    const taskName = isMarkdownTask ? 'Converting to Markdown' : (isPdfToTextTask ? 'Converting PDF to Text' : 'Extracting text');
    
    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setProgressMessage(`${taskName}...`);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const totalSteps = extractFiles.length;
        const results: string[] = [];

        for (let i = 0; i < extractFiles.length; i++) {
            const file = extractFiles[i].file;
            setProgressMessage(`${taskName}: ${file.name}...`);
            
            const base64Data = (await fileToBase64(file)).split(',')[1];
            
            const prompt = isMarkdownTask
                ? "Convert the following document content into Markdown format. Represent structure like headers, lists, and tables correctly. Return only the markdown content."
                : "Extract all text from this document. Return only the extracted text. Preserve the original structure and formatting as much as possible.";

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        {
                            inlineData: {
                                mimeType: file.type,
                                data: base64Data
                            }
                        },
                        {
                            text: prompt
                        }
                    ]
                }
            });

            const text = response.text;
            if (text) {
                if (isMarkdownTask) {
                    results.push(`<!-- File: ${file.name} -->\n\n${text}\n`);
                } else {
                    results.push(`--- File: ${file.name} ---\n\n${text}\n`);
                }
            } else {
                results.push(`--- File: ${file.name} ---\n\n[No content detected]\n`);
            }
            
            setProgress(((i + 1) / totalSteps) * 100);
        }

        setExtractedTextResult(results.join('\n\n'));
        setProgressMessage('Processing complete!');
        
        setTimeout(() => {
            setIsGenerating(false);
        }, 500);

    } catch (e: any) {
        console.error("Error processing AI task:", e);
        setError(`Operation failed. ${e.message || 'An unknown error occurred.'}`);
        setIsGenerating(false);
    }
  };

  const generatePdf = async () => {
    if (taskMode === 'extractText' || taskMode === 'pdfToMd' || taskMode === 'pdfToText') {
        handleAiTask();
        return;
    }

    if (taskMode === 'mergePdfs') {
      if (pdfFiles.length < 2) {
        setError('Please select at least two PDF files to merge.');
        return;
      }
    } else if (taskMode === 'textToPdf') {
        if (txtFiles.length === 0) {
            setError('Please select at least one text or markdown file.');
            return;
        }
    } else if (taskMode === 'pptToPdf') {
        if (pptFiles.length === 0) {
             setError('Please upload at least one PPTX file.');
             return;
        }
    } else {
      if (files.length === 0) {
        setError('Please upload at least one image.');
        return;
      }
    }

     if (taskMode === 'merge' && !existingPdfFile) {
        setError('Please select a PDF file to merge with.');
        return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setProgressMessage('Initializing PDF creation...');
    
    try {
        let pdfDoc;
        
        if (taskMode === 'pptToPdf') {
            setProgressMessage('Parsing PPTX files (Parallel)...');
            let parsedPpts;
            try {
                parsedPpts = await Promise.all(pptFiles.map(pf => parsePptx(pf.file)));
            } catch (err: any) {
                 setError(err.message || "Failed to parse PPTX files.");
                 setIsGenerating(false);
                 return;
            }
            
            for (let i = 0; i < parsedPpts.length; i++) {
                const ppt = parsedPpts[i];
                const pdfName = ppt.filename.replace(/\.pptx$/i, '') + '.pdf';
                setProgressMessage(`Generating PDF for ${ppt.filename}...`);
                
                const singlePdfDoc = await PDFDocument.create();
                
                if (ppt.slides.length === 0) {
                     const page = singlePdfDoc.addPage([PageSizes.A4[1], PageSizes.A4[0]]);
                     page.drawText('No slides found in presentation.', { x: 50, y: 500, size: 24 });
                } else {
                    for (const slide of ppt.slides) {
                        if (printRef.current) {
                            const slideHtml = `
                                <div style="width: 794px; height: 596px; padding: 40px; background: white; display: flex; flex-direction: column; justify-content: space-between; position: relative; font-family: sans-serif; overflow: hidden; border: 1px solid #eee; color: #000000 !important;">
                                    <div style="flex: 1; margin-bottom: 20px;">
                                    <h3 style="color: #000000 !important; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-bottom: 20px;">Slide ${slide.id}</h3>
                                    <div style="font-size: 18px; line-height: 1.5; color: #000000 !important;">
                                        ${slide.text.length > 0 ? slide.text.filter(t => t.trim().length > 0).map(t => `<p style="margin-bottom: 8px; color: #000000 !important;">• ${t}</p>`).join('') : '<p style="color:#666; font-style:italic;">(No text content)</p>'}
                                    </div>
                                    </div>
                                    ${slide.images.length > 0 ? `
                                    <div style="display: flex; gap: 10px; justify-content: center; height: 250px;">
                                        ${slide.images.map(src => `<img src="${src}" style="max-height: 100%; max-width: 100%; object-fit: contain; border-radius: 4px;" />`).join('')}
                                    </div>` : ''}
                                </div>
                            `;
                            
                            printRef.current.innerHTML = slideHtml;
                            const images = printRef.current.querySelectorAll('img');
                            const promises: Promise<void>[] = [];
                            images.forEach((img) => {
                                if (!img.complete) {
                                    promises.push(new Promise((resolve) => {
                                        img.onload = () => resolve();
                                        img.onerror = () => resolve();
                                    }));
                                }
                            });
                            if (promises.length > 0) {
                                 await Promise.all(promises);
                            }
                            await new Promise(r => setTimeout(r, 100));
                            
                            const canvas = await html2canvas(printRef.current, {
                                scale: 1.5,
                                useCORS: true,
                                logging: false,
                                backgroundColor: '#FFFFFF'
                            });
                            
                            const imgData = canvas.toDataURL('image/png');
                            const img = await singlePdfDoc.embedPng(imgData);
                            const page = singlePdfDoc.addPage([842, 595]); 
                            page.drawImage(img, {
                                x: 24, 
                                y: 0,
                                width: 794,
                                height: 596
                            });
                        }
                    }
                }
                
                const pdfBytes = await singlePdfDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = pdfName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
                ppt.slides.forEach(s => s.images.forEach(url => URL.revokeObjectURL(url)));
                setProgress(((i + 1) / parsedPpts.length) * 100);
            }
            
            setProgressMessage('All PPTs converted!');
            setTimeout(() => {
              setIsGenerating(false);
              setPptFiles([]);
            }, 2000);
            return;

        } else if (taskMode === 'mergePdfs') {
            pdfDoc = await PDFDocument.create();
            const totalSteps = pdfFiles.length;
            for (let i = 0; i < pdfFiles.length; i++) {
                const pdfFile = pdfFiles[i];
                setProgressMessage(`Processing ${pdfFile.file.name}...`);
                const pdfBytes = await pdfFile.file.arrayBuffer();
                const donorPdf = await PDFDocument.load(pdfBytes);
                const copiedPages = await pdfDoc.copyPages(donorPdf, donorPdf.getPageIndices());
                copiedPages.forEach((page) => {
                    pdfDoc.addPage(page);
                });
                setProgress(((i + 1) / totalSteps) * 100);
            }
        } else if (taskMode === 'textToPdf') {
            pdfDoc = await PDFDocument.create();
            const totalSteps = txtFiles.length;

            for (let i = 0; i < txtFiles.length; i++) {
                const txtFile = txtFiles[i];
                setProgressMessage(`Rendering ${txtFile.file.name}...`);
                const rawText = await txtFile.file.text();
                
                let htmlContent = '';
                const isMarkdown = txtFile.file.name.toLowerCase().endsWith('.md') || txtFile.file.name.toLowerCase().endsWith('.markdown');

                if (isMarkdown) {
                    htmlContent = await marked.parse(rawText);
                } else {
                    htmlContent = `<pre style="white-space: pre-wrap; font-family: monospace;">${rawText}</pre>`;
                }

                // Enhanced styling to fix tables and forced black text for high visibility in PDF
                const customStyle = `
                <style>
                    body, .markdown-container { 
                        color: #000000 !important; 
                        background-color: #ffffff !important;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
                    }
                    table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; border: 1.5px solid #000000; table-layout: auto; }
                    th, td { border: 1.5px solid #000000; padding: 12px; text-align: left; word-break: break-word; color: #000000 !important; }
                    th { background-color: #eeeeee; font-weight: 800; }
                    tr:nth-child(even) { background-color: #fafafa; }
                    img { max-width: 100%; height: auto; display: block; margin: 1rem auto; }
                    h1, h2, h3, h4, h5, h6 { color: #000000 !important; margin-top: 2rem; margin-bottom: 1rem; border-bottom: 1px solid #000; padding-bottom: 4px; }
                    p, li, span, div, a { color: #000000 !important; }
                    pre { background-color: #f5f5f5; color: #000000 !important; padding: 1rem; border: 1px solid #000; border-radius: 0.5rem; overflow-x: auto; margin-bottom: 1.5rem; }
                    code { color: #000000 !important; font-weight: 600; }
                    blockquote { border-left: 6px solid #000; padding-left: 1rem; color: #000000 !important; font-style: italic; }
                </style>
                `;

                if (printRef.current) {
                    // Start with a clean container at standard A4 width
                    printRef.current.style.width = '794px';
                    printRef.current.style.minHeight = '1123px';
                    printRef.current.style.color = '#000000';
                    printRef.current.style.backgroundColor = '#FFFFFF';
                    printRef.current.innerHTML = `<div class="markdown-container">${customStyle}${htmlContent}</div>`;
                    
                    // Allow images to load
                    const imgs = printRef.current.querySelectorAll('img');
                    await Promise.all([...imgs].map(img => {
                        if (img.complete) return Promise.resolve();
                        return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
                    }));
                    
                    // Wait for layout settlement
                    await new Promise(r => setTimeout(r, 200));

                    // If content (like a table) is wider than 794px, expand the container
                    const actualContentWidth = Math.max(794, printRef.current.scrollWidth);
                    if (actualContentWidth > 794) {
                        printRef.current.style.width = `${actualContentWidth}px`;
                    }
                    
                    const canvas = await html2canvas(printRef.current, {
                        scale: 2, 
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#FFFFFF',
                        width: actualContentWidth, 
                    });
                    
                    // Reset container width for next iteration
                    printRef.current.style.width = '794px';

                    const canvasWidth = canvas.width;
                    const canvasHeight = canvas.height;
                    const pdfPageWidth = PageSizes.A4[0];
                    const pdfPageHeight = PageSizes.A4[1];
                    
                    // The srcChunkHeight is the height of one PDF page in source canvas pixels
                    const srcChunkHeight = (pdfPageHeight / pdfPageWidth) * canvasWidth;
                    
                    let yOffset = 0;
                    while (yOffset < canvasHeight) {
                        const page = pdfDoc.addPage([pdfPageWidth, pdfPageHeight]);
                        const remainingSrcHeight = canvasHeight - yOffset;
                        const chunkHeight = Math.min(srcChunkHeight, remainingSrcHeight);
                        
                        const sliceCanvas = document.createElement('canvas');
                        sliceCanvas.width = canvasWidth;
                        sliceCanvas.height = chunkHeight;
                        
                        const ctx = sliceCanvas.getContext('2d');
                        if (ctx) {
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                            // Draw the slice from the source canvas
                            ctx.drawImage(canvas, 0, -yOffset);
                            
                            const sliceImgData = sliceCanvas.toDataURL('image/png');
                            const sliceEmbed = await pdfDoc.embedPng(sliceImgData);
                            
                            // Scale the chunk to fit the PDF page width
                            const sliceScaledHeight = (chunkHeight * pdfPageWidth) / canvasWidth;
                            
                            page.drawImage(sliceEmbed, {
                                x: 0,
                                y: pdfPageHeight - sliceScaledHeight,
                                width: pdfPageWidth,
                                height: sliceScaledHeight
                            });
                        }
                        yOffset += srcChunkHeight;
                    }
                }
                setProgress(((i + 1) / totalSteps) * 100);
            }

        } else {
            // Standard image-to-PDF logic
            if (taskMode === 'merge' && existingPdfFile) {
                setProgressMessage('Loading existing PDF...');
                const existingPdfBytes = await existingPdfFile.arrayBuffer();
                pdfDoc = await PDFDocument.load(existingPdfBytes);
            } else {
                pdfDoc = await PDFDocument.create();
            }

            const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            let embeddedWatermarkImage = null;

            if (watermarkImage) {
              const watermarkBytes = await watermarkImage.file.arrayBuffer();
              embeddedWatermarkImage = watermarkImage.file.type === 'image/png'
                ? await pdfDoc.embedPng(watermarkBytes)
                : await pdfDoc.embedJpg(watermarkBytes);
            }
            
            const pageSize: [number, number] = [PageSizes.A4[0], PageSizes.A4[1]];
            if (pageOrientation === 'landscape') {
                pageSize.reverse();
            }

            const imageChunks: AppFile[][] = [];
            for (let i = 0; i < files.length; i += imagesPerPage) {
                imageChunks.push(files.slice(i, i + imagesPerPage));
            }
            
            const totalSteps = imageChunks.length;

            for (let i = 0; i < imageChunks.length; i++) {
              const chunk = imageChunks[i];
              setProgressMessage(`Processing page ${i + 1} of ${totalSteps}...`);
              const page = pdfDoc.addPage(pageSize);
              const { width: pageWidth, height: pageHeight } = page.getSize();
              
              if (backgroundColor !== '#FFFFFF') {
                const { r, g, b } = hexToRgb(backgroundColor);
                page.drawRectangle({
                  x: 0,
                  y: 0,
                  width: pageWidth,
                  height: pageHeight,
                  color: rgb(r, g, b),
                });
              }

              const margin = pageMargins;
              const drawArea = {
                x: margin,
                y: margin,
                width: pageWidth - margin * 2,
                height: pageHeight - margin * 2,
              };
              
              const grid = {
                rows: imagesPerPage === 4 ? 2 : (imagesPerPage === 2 ? 2 : 1),
                cols: imagesPerPage === 4 ? 2 : 1,
              };
              const cellWidth = drawArea.width / grid.cols;
              const cellHeight = drawArea.height / grid.rows;
              
              for (let j = 0; j < chunk.length; j++) {
                const appFile = chunk[j];
                const imageBytes = await appFile.file.arrayBuffer();
                const image = appFile.file.type === 'image/png'
                  ? await pdfDoc.embedPng(imageBytes)
                  : await pdfDoc.embedJpg(imageBytes);

                const scaled = image.scaleToFit(cellWidth, cellHeight);
                const row = Math.floor(j / grid.cols);
                const col = j % grid.cols;
                const cellX = drawArea.x + col * cellWidth;
                const cellY = drawArea.y + (grid.rows - 1 - row) * cellHeight;

                page.drawImage(image, {
                  x: cellX + (cellWidth - scaled.width) / 2,
                  y: cellY + (cellHeight - scaled.height) / 2,
                  width: scaled.width,
                  height: scaled.height,
                });
              }

              if (watermarkText) {
                const textSize = Math.min(pageWidth, pageHeight) / 10;
                const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, textSize);
                page.drawText(watermarkText, {
                    x: (pageWidth - textWidth) / 2,
                    y: pageHeight / 2 - textSize / 2,
                    font: helveticaFont,
                    size: textSize,
                    color: rgb(0, 0, 0),
                    opacity: watermarkOpacity,
                    rotate: degrees(45),
                });
              }

              if (embeddedWatermarkImage) {
                const scaled = embeddedWatermarkImage.scaleToFit(pageWidth / 2, pageHeight / 2);
                page.drawImage(embeddedWatermarkImage, {
                    x: (pageWidth - scaled.width) / 2,
                    y: (pageHeight - scaled.height) / 2,
                    width: scaled.width,
                    height: scaled.height,
                    opacity: watermarkImageOpacity,
                });
              }
              setProgress(((i + 1) / totalSteps) * 100);
            }
        }
        
        setProgressMessage('Finalizing and saving PDF...');
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        
        let finalFilename = '';
        if (outputFilename.trim()) {
            finalFilename = outputFilename.trim();
            if (!finalFilename.toLowerCase().endsWith('.pdf')) {
                finalFilename += '.pdf';
            }
        } else {
            finalFilename = taskMode === 'merge' && existingPdfFile 
                ? `merged-${existingPdfFile.name}` 
                : (taskMode === 'mergePdfs' 
                    ? 'merged-documents.pdf' 
                    : (taskMode === 'textToPdf' ? 'converted-document.pdf' : 'converted-images.pdf'));
        }
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        setProgressMessage('PDF generated successfully!');
        setTimeout(() => {
          setIsGenerating(false);
          files.forEach(f => URL.revokeObjectURL(f.previewUrl));
          if (watermarkImage) URL.revokeObjectURL(watermarkImage.previewUrl);
          setFiles([]);
          setPdfFiles([]);
          setTxtFiles([]);
          setExistingPdfFile(null);
          setWatermarkImage(null);
          setOutputFilename('');
        }, 2000);
        
    } catch (e: any) {
        console.error("Error generating PDF:", e);
        setError(`PDF generation failed. ${e.message || 'An unknown error occurred.'}`);
        setIsGenerating(false);
    }
  };

  const PdfUploader: React.FC = () => {
    const [isDragging, setIsDragging] = useState(false);
    const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const files = [...e.dataTransfer.files];
        if (files.length > 0) handlePdfFilesAccepted(files);
    }, [handlePdfFilesAccepted]);
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? [...e.target.files] : [];
      if (files.length > 0) handlePdfFilesAccepted(files);
      e.target.value = '';
    };
    return (
      <label onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
      className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-accent transition-colors dark:bg-slate-800 dark:hover:bg-slate-700 ${
        isDragging ? 'border-primary dark:border-slate-300' : 'border-muted dark:border-slate-600'}`}>
      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
        <PdfFileIcon className="w-10 h-10 mb-3 text-muted-foreground dark:text-slate-400" />
        <p className="mb-2 text-sm text-muted-foreground dark:text-slate-400">
          <span className="font-semibold text-primary dark:text-slate-200">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-muted-foreground dark:text-slate-500">Select one or more PDF files</p>
      </div>
      <input id="pdf-dropzone-file" type="file" className="hidden" multiple accept="application/pdf" onChange={handleFileChange} />
    </label>
    );
  };

  const TxtUploader: React.FC = () => {
    const [isDragging, setIsDragging] = useState(false);
    const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const files = [...e.dataTransfer.files];
        if (files.length > 0) handleTxtFilesAccepted(files);
    }, [handleTxtFilesAccepted]);
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? [...e.target.files] : [];
      if (files.length > 0) handleTxtFilesAccepted(files);
      e.target.value = '';
    };
    return (
      <label onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
      className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-accent transition-colors dark:bg-slate-800 dark:hover:bg-slate-700 ${
        isDragging ? 'border-primary dark:border-slate-300' : 'border-muted dark:border-slate-600'}`}>
      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
        <FileTextIcon className="w-10 h-10 mb-3 text-muted-foreground dark:text-slate-400" />
        <p className="mb-2 text-sm text-muted-foreground dark:text-slate-400">
          <span className="font-semibold text-primary dark:text-slate-200">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-muted-foreground dark:text-slate-500">Text files (.txt) or Markdown (.md)</p>
      </div>
      <input id="txt-dropzone-file" type="file" className="hidden" multiple accept="text/plain, .txt, .md, .markdown" onChange={handleFileChange} />
    </label>
    );
  };

  const OptionGroup: React.FC<{title: string, children: React.ReactNode, disabled?: boolean}> = ({title, children, disabled}) => (
    <div className={`space-y-2 rounded-lg border dark:border-slate-700 p-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h4 className="text-sm font-semibold text-muted-foreground dark:text-slate-300">{title}</h4>
        {children}
    </div>
  );
  
  const isPdfMergeMode = taskMode === 'mergePdfs';
  const isTextMode = taskMode === 'textToPdf';
  const isExtractMode = taskMode === 'extractText';
  const isPdfToMdMode = taskMode === 'pdfToMd';
  const isPptToPdfMode = taskMode === 'pptToPdf';
  const isPdfToTextMode = taskMode === 'pdfToText';
  const isAiMode = isExtractMode || isPdfToMdMode || isPdfToTextMode;

  const placeholderFilename = useMemo(() => {
    if (taskMode === 'mergePdfs') return 'merged-documents.pdf';
    if (taskMode === 'textToPdf') return 'converted-document.pdf';
    if (taskMode === 'merge' && existingPdfFile) return `merged-${existingPdfFile.name}`;
    if (taskMode === 'extractText') return 'extracted-text.txt';
    if (taskMode === 'pdfToMd') return 'converted.md';
    if (taskMode === 'pptToPdf') return 'converted-presentation.pdf';
    if (taskMode === 'pdfToText') return 'converted.txt';
    return 'converted-images.pdf';
  }, [taskMode, existingPdfFile]);

  return (
    <div className="bg-secondary min-h-screen font-sans text-primary dark:bg-slate-900 dark:text-slate-50 transition-colors">
      <div className="container mx-auto px-4 py-8 md:py-16 max-w-4xl">
        <header className="text-center mb-10 relative">
            <div className="flex justify-center items-center">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary-foreground bg-primary dark:bg-slate-800 dark:text-slate-50 rounded-lg py-2 px-4 inline-block">
                    Image to PDF Converter
                </h1>
                <button onClick={toggleTheme} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full text-muted-foreground hover:bg-accent dark:text-slate-400 dark:hover:bg-slate-700 transition-colors" aria-label="Toggle theme">
                    {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
                </button>
            </div>
            <p className="mt-4 text-lg text-muted-foreground dark:text-slate-400 max-w-2xl mx-auto">
                Easily merge your images or text files into a single PDF, extract text, or convert between formats.
            </p>
        </header>

        <main className="space-y-8">
            {isPdfMergeMode ? (
              <>
                <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                    <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">1. Upload Your PDF Files</h2>
                    <PdfUploader />
                </div>
                {pdfFiles.length > 0 && (
                    <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                        <div className="flex justify-between items-center">
                          <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">2. Arrange Your Files</h2>
                          <button onClick={handleClearAllPdfs} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"><TrashIcon className="w-4 h-4" /> Clear All</button>
                        </div>
                        <PdfList files={pdfFiles} onRemoveFile={handleRemovePdfFile} onReorderFiles={handleReorderPdfFiles} />
                    </div>
                )}
              </>
            ) : isTextMode ? (
                <>
                <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                    <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">1. Upload Text or Markdown Files</h2>
                    <TxtUploader />
                </div>
                {txtFiles.length > 0 && (
                    <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                        <div className="flex justify-between items-center">
                          <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">2. Arrange Your Files</h2>
                          <button onClick={handleClearAllTxts} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"><TrashIcon className="w-4 h-4" /> Clear All</button>
                        </div>
                        <TxtList files={txtFiles} onRemoveFile={handleRemoveTxtFile} onReorderFiles={handleReorderTxtFiles} />
                    </div>
                )}
              </>
            ) : isAiMode ? (
                <>
                <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                    <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">1. Upload Documents or Images</h2>
                    <MixedUploader onFilesAccepted={handleExtractFilesAccepted} />
                </div>
                {extractFiles.length > 0 && (
                     <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                        <div className="flex justify-between items-center">
                          <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">2. Files to Process</h2>
                          <button onClick={handleClearAllExtract} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"><TrashIcon className="w-4 h-4" /> Clear All</button>
                        </div>
                        <MixedFileList files={extractFiles} onRemoveFile={handleRemoveExtractFile} onReorderFiles={handleReorderExtractFiles} />
                    </div>
                )}
                </>
            ) : isPptToPdfMode ? (
              <>
                 <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                    <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">1. Upload PPTX Files</h2>
                    <MixedUploader onFilesAccepted={handlePptFilesAccepted} acceptPpt={true} />
                </div>
                 {pptFiles.length > 0 && (
                     <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                        <div className="flex justify-between items-center">
                          <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">2. PPTX Files</h2>
                          <button onClick={handleClearAllPpt} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"><TrashIcon className="w-4 h-4" /> Clear All</button>
                        </div>
                        <MixedFileList files={pptFiles} onRemoveFile={handleRemovePptFile} onReorderFiles={handleReorderPptFiles} />
                    </div>
                )}
              </>
            ) : (
              <>
                <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                    <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">1. Upload Your Images</h2>
                    <ImageUploader onFilesAccepted={handleFilesAccepted} />
                </div>
                {files.length > 0 && (
                    <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                        <div className="flex justify-between items-center">
                          <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">2. Arrange Your Files</h2>
                          <button onClick={handleClearAll} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"><TrashIcon className="w-4 h-4" /> Clear All</button>
                        </div>
                        <ImageList files={files} onRemoveFile={handleRemoveFile} onReorderFiles={handleReorderFiles} onConvertToSvg={handleConvertToSvg} />
                    </div>
                )}
              </>
            )}
            
            {error && <div className="bg-destructive/10 text-destructive dark:bg-red-900/50 dark:text-red-300 font-medium p-3 rounded-lg text-center" role="alert">{error}</div>}

            <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50 text-center mb-2">3. Process Files</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                      <OptionGroup title="Task">
                        <div role="radiogroup" className="grid grid-cols-2 gap-2 rounded-lg bg-muted dark:bg-slate-700 p-1">
                          {[
                            {id:'new', label:'New PDF'}, {id:'textToPdf', label:'Text/MD to PDF'},
                            {id:'merge', label:'Merge w/ PDF'}, {id:'mergePdfs', label:'Merge PDFs'},
                            {id:'extractText', label:'Extract Text'}, {id:'pdfToMd', label:'PDF to Markdown'},
                            {id:'pptToPdf', label:'PPT to PDF'}, {id:'pdfToText', label:'PDF to Text'}
                          ].map(mode => (
                            <button key={mode.id} role="radio" aria-checked={taskMode === mode.id} onClick={() => setTaskMode(mode.id as TaskMode)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${taskMode === mode.id ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}>{mode.label}</button>
                          ))}
                        </div>
                        {taskMode === 'merge' && (
                          <div className="pt-2">
                             {existingPdfFile ? (
                                <div className="flex items-center justify-between text-sm p-2 border rounded-lg bg-secondary dark:bg-slate-700 dark:border-slate-600">
                                   <div className="flex items-center min-w-0"><PdfFileIcon className="w-5 h-5 mr-2 flex-shrink-0" /><span className="truncate">{existingPdfFile.name}</span></div>
                                   <button onClick={() => setExistingPdfFile(null)} className="p-1 rounded-full hover:bg-muted dark:hover:bg-slate-600 ml-2"><XCircleIcon className="w-4 h-4 text-destructive" /></button>
                                </div>
                             ) : (
                                <label className="flex items-center justify-center w-full px-4 py-2 text-sm border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent dark:border-slate-600 dark:hover:bg-slate-700">
                                    <PdfFileIcon className="w-5 h-5 mr-2 text-muted-foreground dark:text-slate-400" /><span className="text-primary dark:text-slate-200 font-medium">Choose a PDF...</span>
                                    <input type="file" className="hidden" accept="application/pdf" onChange={handleExistingPdfChange} />
                                </label>
                             )}
                          </div>
                        )}
                      </OptionGroup>
                      
                      <OptionGroup title="Layout" disabled={isPdfMergeMode || isAiMode || isTextMode || isPptToPdfMode}>
                          <div className="space-y-3">
                              <div>
                                  <label className="text-xs font-medium text-muted-foreground dark:text-slate-400">Page Orientation</label>
                                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted dark:bg-slate-700 p-1 mt-1">
                                      <button onClick={() => setPageOrientation('portrait')} className={`flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${pageOrientation === 'portrait' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}><RectangleVerticalIcon className="w-4 h-4" /> Portrait</button>
                                      <button onClick={() => setPageOrientation('landscape')} className={`flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${pageOrientation === 'landscape' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}><RectangleHorizontalIcon className="w-4 h-4" /> Landscape</button>
                                  </div>
                              </div>
                              <div className="pt-2">
                                  <label htmlFor="margins" className="flex justify-between text-xs font-medium text-muted-foreground dark:text-slate-400">Page Margins <span>{pageMargins}pt</span></label>
                                  <input id="margins" type="range" min="0" max="100" value={pageMargins} onChange={e => setPageMargins(Number(e.target.value))} className="w-full h-2 bg-muted dark:bg-slate-600 rounded-lg appearance-none cursor-pointer mt-1" />
                              </div>
                          </div>
                      </OptionGroup>
                  </div>
                  <div className="space-y-4">
                       <OptionGroup title="Styling" disabled={isPdfMergeMode || isAiMode || isTextMode || isPptToPdfMode}>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between"><label htmlFor="bgcolor" className="text-xs font-medium text-muted-foreground dark:text-slate-400">Background Color</label><input id="bgcolor" type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className="w-8 h-8 p-0 border-none rounded-md cursor-pointer bg-card dark:bg-slate-700" /></div>
                                <div><label htmlFor="watermarkText" className="text-xs font-medium text-muted-foreground dark:text-slate-400">Text Watermark</label><input id="watermarkText" type="text" placeholder="e.g., DRAFT" value={watermarkText} onChange={e => setWatermarkText(e.target.value)} className="mt-1 w-full px-3 py-1.5 text-sm bg-secondary dark:bg-slate-700 border rounded-md dark:border-slate-600" /></div>
                                <div><label className="text-xs font-medium text-muted-foreground dark:text-slate-400">Image Watermark</label>
                                    {watermarkImage ? (
                                        <div className="flex items-center justify-between text-sm p-2 mt-1 border rounded-lg bg-secondary dark:bg-slate-700 dark:border-slate-600"><div className="flex items-center min-w-0"><img src={watermarkImage.previewUrl} className="w-6 h-6 mr-2 rounded-sm object-contain" /><span className="truncate">{watermarkImage.file.name}</span></div><button onClick={() => setWatermarkImage(null)} className="p-1 rounded-full ml-2"><XCircleIcon className="w-4 h-4 text-destructive" /></button></div>
                                    ) : (
                                        <label className="flex items-center justify-center w-full px-4 py-2 mt-1 text-sm border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent dark:border-slate-600 dark:hover:bg-slate-700"><span className="text-primary dark:text-slate-200 font-medium">Choose image...</span><input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleWatermarkImageChange} /></label>
                                    )}
                                </div>
                            </div>
                        </OptionGroup>
                       <OptionGroup title="Quality" disabled={isPdfMergeMode || isTextMode || isAiMode || isPptToPdfMode}>
                         <div role="radiogroup" className="grid grid-cols-2 gap-2 rounded-lg bg-muted dark:bg-slate-700 p-1">
                          <button onClick={() => setPdfQuality('Standard')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${pdfQuality === 'Standard' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}>Standard</button>
                          <button onClick={() => setPdfQuality('High')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${pdfQuality === 'High' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}>High</button>
                        </div>
                       </OptionGroup>
                  </div>
                </div>

                {!isAiMode && !isPptToPdfMode && (
                <div className="pt-2">
                  <label htmlFor="outputFilename" className="block mb-2 text-sm font-semibold text-muted-foreground dark:text-slate-300">Output Filename (optional)</label>
                  <input id="outputFilename" type="text" placeholder={placeholderFilename} value={outputFilename} onChange={(e) => setOutputFilename(e.target.value)} className="w-full px-3 py-2 text-sm bg-secondary dark:bg-slate-700 border rounded-md dark:border-slate-600 outline-none transition-colors" />
                </div>
                )}

                <div className="pt-4">
                  <button onClick={generatePdf} disabled={isGenerating || (isPdfMergeMode ? pdfFiles.length < 2 : (isTextMode ? txtFiles.length === 0 : (isAiMode ? extractFiles.length === 0 : (isPptToPdfMode ? pptFiles.length === 0 : files.length === 0))))} 
                    className="flex items-center justify-center w-full px-6 py-3 text-base font-semibold text-primary-foreground bg-primary rounded-lg shadow-md hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground transition-all dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200">
                      {isGenerating ? (isAiMode ? 'Processing...' : (isPptToPdfMode ? 'Converting...' : 'Generating PDF...')) : (isExtractMode ? 'Extract Text' : (isPdfToMdMode ? 'Convert to Markdown' : (isPdfToTextMode ? 'Convert to Text' : (isPptToPdfMode ? 'Convert to PDFs' : 'Generate PDF'))))}
                  </button>
                </div>
                
                {isGenerating && (
                  <div className="w-full max-w-md text-center mx-auto mt-4">
                    <div className="w-full bg-muted dark:bg-slate-700 rounded-full h-2.5 mb-2 overflow-hidden">
                        <div className="bg-primary dark:bg-slate-300 h-2.5 rounded-full transition-all duration-300 ease-linear" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-sm text-muted-foreground dark:text-slate-400 truncate">{progressMessage}</p>
                    <p className="font-semibold text-primary dark:text-slate-200">{Math.round(progress)}%</p>
                  </div>
                )}
            </div>
        </main>
        
        <footer className="text-center mt-12 pb-8">
            <p className="text-sm text-muted-foreground dark:text-slate-500">Powered by React, pdf-lib, JSZip, html2canvas & Gemini. All processing is secure.</p>
        </footer>
      </div>

      <div 
        ref={printRef} 
        className="absolute top-0 left-[-9999px] bg-white text-black p-12 prose prose-slate max-w-none overflow-x-visible"
        style={{ minWidth: '794px', width: '794px', color: '#000000', backgroundColor: '#FFFFFF' }}
      ></div>
      
      {fileToConvert && <SvgConverterModal file={fileToConvert} onClose={handleCloseConverter} />}
      {extractedTextResult && (
        <ExtractionResultModal 
            text={extractedTextResult} 
            onClose={() => setExtractedTextResult(null)}
            title={taskMode === 'pdfToMd' ? 'Markdown Result' : (taskMode === 'pdfToText' ? 'Text Result' : 'Extracted Text Result')}
            extension={taskMode === 'pdfToMd' ? 'md' : 'txt'}
        />
      )}
    </div>
  );
};

export default App;