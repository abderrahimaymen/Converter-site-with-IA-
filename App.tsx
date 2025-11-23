import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { PDFDocument, rgb, StandardFonts, PageSizes, degrees } from 'pdf-lib';
import ImageUploader from './components/ImageUploader';
import ImageList from './components/ImageList';
import PdfList from './components/PdfList';
import TxtList from './components/TxtList';
import SvgConverterModal from './components/SvgConverterModal';
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
type TaskMode = 'new' | 'merge' | 'mergePdfs' | 'textToPdf';
type PageOrientation = 'portrait' | 'landscape';
type ImagesPerPage = 1 | 2 | 4;
type FontType = 'Courier' | 'Helvetica' | 'Times';

const App: React.FC = () => {
  const [files, setFiles] = useState<AppFile[]>([]);
  const [pdfFiles, setPdfFiles] = useState<AppFile[]>([]);
  const [txtFiles, setTxtFiles] = useState<AppFile[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  
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
        // Basic check for text file type or extension
        if (file.type !== 'text/plain' && !file.name.toLowerCase().endsWith('.txt')) {
            validationErrors.push(`'${file.name}' (not a text file)`);
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

  const generatePdf = async () => {
    if (taskMode === 'mergePdfs') {
      if (pdfFiles.length < 2) {
        setError('Please select at least two PDF files to merge.');
        return;
      }
    } else if (taskMode === 'textToPdf') {
        if (txtFiles.length === 0) {
            setError('Please select at least one text file.');
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

        if (taskMode === 'mergePdfs') {
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
            const standardFont = fontType === 'Courier' 
                ? StandardFonts.Courier 
                : (fontType === 'Times' ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
            
            const font = await pdfDoc.embedFont(standardFont);
            const size = fontSize;
            const lineHeight = size * 1.2;

            const pageSize: [number, number] = [PageSizes.A4[0], PageSizes.A4[1]];
            if (pageOrientation === 'landscape') pageSize.reverse();
            
            const drawBackground = (p: any) => {
                if (backgroundColor !== '#FFFFFF') {
                   const { r, g, b } = hexToRgb(backgroundColor);
                   p.drawRectangle({ x: 0, y: 0, width: p.getWidth(), height: p.getHeight(), color: rgb(r, g, b) });
                }
            };
            
            let page = pdfDoc.addPage(pageSize);
            drawBackground(page);
            let { width, height } = page.getSize();
            
            const margin = pageMargins;
            const maxWidth = width - (margin * 2);
            const startY = height - margin;
            let currentY = startY;
            
            const totalSteps = txtFiles.length;

            // Sanitizer to prevent WinAnsi encoding errors
            const sanitizeText = (str: string) => {
                return str.replace(/[^\u0000-\u00FF]/g, '?');
            };

            for (let i = 0; i < txtFiles.length; i++) {
                const txtFile = txtFiles[i];
                setProgressMessage(`Processing ${txtFile.file.name}...`);
                const rawText = await txtFile.file.text();
                const text = sanitizeText(rawText);
                
                if (i > 0) {
                     page = pdfDoc.addPage(pageSize);
                     drawBackground(page);
                     currentY = startY;
                }

                const paragraphs = text.split(/\r\n|\r|\n/);
                
                for (const paragraph of paragraphs) {
                    // Check for empty line
                    if (paragraph.length === 0) {
                        currentY -= lineHeight;
                        if (currentY < margin) {
                           page = pdfDoc.addPage(pageSize);
                           drawBackground(page);
                           currentY = startY;
                        }
                        continue;
                    }

                    const words = paragraph.split(' ');
                    let currentLine = '';
                    
                    for (let w = 0; w < words.length; w++) {
                        const word = words[w];
                        const testLine = currentLine.length === 0 ? word : `${currentLine} ${word}`;
                        const textWidth = font.widthOfTextAtSize(testLine, size);
                        
                        if (textWidth <= maxWidth) {
                            currentLine = testLine;
                        } else {
                            // Draw current line
                            page.drawText(currentLine, { x: margin, y: currentY, size, font, color: rgb(0,0,0) });
                            currentY -= lineHeight;
                            if (currentY < margin) {
                                page = pdfDoc.addPage(pageSize);
                                drawBackground(page);
                                currentY = startY;
                            }
                            currentLine = word; // Start new line
                        }
                    }
                    // Draw last line of paragraph
                    if (currentLine.length > 0) {
                        page.drawText(currentLine, { x: margin, y: currentY, size, font, color: rgb(0,0,0) });
                        currentY -= lineHeight;
                         if (currentY < margin) {
                            page = pdfDoc.addPage(pageSize);
                            drawBackground(page);
                            currentY = startY;
                         }
                    }
                }
                setProgress(((i + 1) / totalSteps) * 100);
            }

        } else {
            // Logic for image-based PDF generation
            if (taskMode === 'merge' && existingPdfFile) {
                setProgressMessage('Loading existing PDF...');
                const existingPdfBytes = await existingPdfFile.arrayBuffer();
                pdfDoc = await PDFDocument.load(existingPdfBytes);
            } else {
                pdfDoc = await PDFDocument.create();
            }

            const quality = pdfQuality === 'High' ? 1.0 : 0.8;
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
                    : (taskMode === 'textToPdf' ? 'converted-text.pdf' : 'converted-images.pdf'));
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

    const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };
  
    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };
  
    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
    };
  
    const handleDrop = useCallback(
      (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
  
        const files = [...e.dataTransfer.files];
        if (files.length > 0) {
          handlePdfFilesAccepted(files);
        }
      },
      [handlePdfFilesAccepted]
    );
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? [...e.target.files] : [];
      if (files.length > 0) {
        handlePdfFilesAccepted(files);
      }
      e.target.value = '';
    };

    return (
      <label
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-accent transition-colors dark:bg-slate-800 dark:hover:bg-slate-700 ${
        isDragging ? 'border-primary dark:border-slate-300' : 'border-muted dark:border-slate-600'
      }`}
    >
      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
        <PdfFileIcon className="w-10 h-10 mb-3 text-muted-foreground dark:text-slate-400" />
        <p className="mb-2 text-sm text-muted-foreground dark:text-slate-400">
          <span className="font-semibold text-primary dark:text-slate-200">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-muted-foreground dark:text-slate-500">Select one or more PDF files</p>
      </div>
      <input 
        id="pdf-dropzone-file" 
        type="file" 
        className="hidden" 
        multiple 
        accept="application/pdf"
        onChange={handleFileChange}
      />
    </label>
    )
  }

  const TxtUploader: React.FC = () => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };
  
    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };
  
    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
    };
  
    const handleDrop = useCallback(
      (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
  
        const files = [...e.dataTransfer.files];
        if (files.length > 0) {
          handleTxtFilesAccepted(files);
        }
      },
      [handleTxtFilesAccepted]
    );
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? [...e.target.files] : [];
      if (files.length > 0) {
        handleTxtFilesAccepted(files);
      }
      e.target.value = '';
    };

    return (
      <label
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-accent transition-colors dark:bg-slate-800 dark:hover:bg-slate-700 ${
        isDragging ? 'border-primary dark:border-slate-300' : 'border-muted dark:border-slate-600'
      }`}
    >
      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
        <FileTextIcon className="w-10 h-10 mb-3 text-muted-foreground dark:text-slate-400" />
        <p className="mb-2 text-sm text-muted-foreground dark:text-slate-400">
          <span className="font-semibold text-primary dark:text-slate-200">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-muted-foreground dark:text-slate-500">Select one or more Text files (.txt)</p>
      </div>
      <input 
        id="txt-dropzone-file" 
        type="file" 
        className="hidden" 
        multiple 
        accept="text/plain, .txt"
        onChange={handleFileChange}
      />
    </label>
    )
  }

  const OptionGroup: React.FC<{title: string, children: React.ReactNode, disabled?: boolean}> = ({title, children, disabled}) => (
    <div className={`space-y-2 rounded-lg border dark:border-slate-700 p-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h4 className="text-sm font-semibold text-muted-foreground dark:text-slate-300">{title}</h4>
        {children}
    </div>
  );
  
  const isPdfMergeMode = taskMode === 'mergePdfs';
  const isTextMode = taskMode === 'textToPdf';

  const placeholderFilename = useMemo(() => {
    if (taskMode === 'mergePdfs') return 'merged-documents.pdf';
    if (taskMode === 'textToPdf') return 'converted-text.pdf';
    if (taskMode === 'merge' && existingPdfFile) return `merged-${existingPdfFile.name}`;
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
                <button
                    onClick={toggleTheme}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full text-muted-foreground hover:bg-accent dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Toggle theme"
                >
                    {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
                </button>
            </div>
            <p className="mt-4 text-lg text-muted-foreground dark:text-slate-400 max-w-2xl mx-auto">
                Easily merge your images or text files into a single, elegant PDF file. Just upload, reorder, and download.
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
                          <button 
                            onClick={handleClearAllPdfs}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            aria-label="Remove all PDF files"
                          >
                            <TrashIcon className="w-4 h-4" />
                            Clear All
                          </button>
                        </div>
                        <p className="text-sm text-muted-foreground dark:text-slate-400">Drag and drop the files to set their order in the final PDF.</p>
                        <PdfList 
                            files={pdfFiles}
                            onRemoveFile={handleRemovePdfFile}
                            onReorderFiles={handleReorderPdfFiles}
                        />
                    </div>
                )}
              </>
            ) : isTextMode ? (
                <>
                <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                    <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">1. Upload Your Text Files</h2>
                    <TxtUploader />
                </div>

                {txtFiles.length > 0 && (
                    <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                        <div className="flex justify-between items-center">
                          <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50">2. Arrange Your Files</h2>
                          <button 
                            onClick={handleClearAllTxts}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            aria-label="Remove all Text files"
                          >
                            <TrashIcon className="w-4 h-4" />
                            Clear All
                          </button>
                        </div>
                        <p className="text-sm text-muted-foreground dark:text-slate-400">Drag and drop the files to set their order in the final PDF.</p>
                        <TxtList 
                            files={txtFiles}
                            onRemoveFile={handleRemoveTxtFile}
                            onReorderFiles={handleReorderTxtFiles}
                        />
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
                          <button 
                            onClick={handleClearAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            aria-label="Remove all images"
                          >
                            <TrashIcon className="w-4 h-4" />
                            Clear All
                          </button>
                        </div>
                        <p className="text-sm text-muted-foreground dark:text-slate-400">Drag and drop the images to set their order in the final PDF.</p>
                        <ImageList 
                            files={files}
                            onRemoveFile={handleRemoveFile}
                            onReorderFiles={handleReorderFiles}
                            onConvertToSvg={handleConvertToSvg}
                        />
                    </div>
                )}
              </>
            )}
            
            {error && (
                <div className="bg-destructive/10 text-destructive dark:bg-red-900/50 dark:text-red-300 font-medium p-3 rounded-lg text-center" role="alert">
                    {error}
                </div>
            )}

            <div className="p-6 bg-card rounded-xl shadow-md space-y-6 dark:bg-slate-800/50">
                <h2 className="text-xl font-semibold text-card-foreground dark:text-slate-50 text-center mb-2">3. Create Your PDF</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Options */}
                  <div className="space-y-4">
                      <OptionGroup title="Task">
                        <div role="radiogroup" className="grid grid-cols-2 gap-2 rounded-lg bg-muted dark:bg-slate-700 p-1">
                          <button role="radio" aria-checked={taskMode === 'new'} onClick={() => setTaskMode('new')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${taskMode === 'new' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}>New PDF</button>
                          <button role="radio" aria-checked={taskMode === 'textToPdf'} onClick={() => setTaskMode('textToPdf')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${taskMode === 'textToPdf' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}>Text to PDF</button>
                          <button role="radio" aria-checked={taskMode === 'merge'} onClick={() => setTaskMode('merge')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${taskMode === 'merge' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}>Merge w/ PDF</button>
                          <button role="radio" aria-checked={taskMode === 'mergePdfs'} onClick={() => setTaskMode('mergePdfs')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${taskMode === 'mergePdfs' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}>Merge PDFs</button>
                        </div>
                        {taskMode === 'merge' && (
                          <div className="pt-2">
                             {existingPdfFile ? (
                                <div className="flex items-center justify-between text-sm p-2 border rounded-lg bg-secondary dark:bg-slate-700 dark:border-slate-600">
                                   <div className="flex items-center min-w-0">
                                      <PdfFileIcon className="w-5 h-5 mr-2 flex-shrink-0" />
                                      <span className="truncate" title={existingPdfFile.name}>{existingPdfFile.name}</span>
                                   </div>
                                   <button onClick={() => setExistingPdfFile(null)} className="p-1 rounded-full hover:bg-muted dark:hover:bg-slate-600 ml-2" aria-label="Remove PDF file">
                                        <XCircleIcon className="w-4 h-4 text-destructive" />
                                   </button>
                                </div>
                             ) : (
                                <label className="flex items-center justify-center w-full px-4 py-2 text-sm border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent dark:border-slate-600 dark:hover:bg-slate-700">
                                    <PdfFileIcon className="w-5 h-5 mr-2 text-muted-foreground dark:text-slate-400" />
                                    <span className="text-primary dark:text-slate-200 font-medium">Choose a PDF...</span>
                                    <input id="pdf-upload" type="file" className="hidden" accept="application/pdf" onChange={handleExistingPdfChange} />
                                </label>
                             )}
                          </div>
                        )}
                      </OptionGroup>
                      
                      <OptionGroup title="Layout" disabled={isPdfMergeMode}>
                          <div className="space-y-3">
                              <div>
                                  <label className="text-xs font-medium text-muted-foreground dark:text-slate-400">Page Orientation</label>
                                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted dark:bg-slate-700 p-1 mt-1">
                                      <button onClick={() => setPageOrientation('portrait')} className={`flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${pageOrientation === 'portrait' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}><RectangleVerticalIcon className="w-4 h-4" /> Portrait</button>
                                      <button onClick={() => setPageOrientation('landscape')} className={`flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${pageOrientation === 'landscape' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}><RectangleHorizontalIcon className="w-4 h-4" /> Landscape</button>
                                  </div>
                              </div>
                              {!isTextMode && (
                                  <div>
                                      <label className="text-xs font-medium text-muted-foreground dark:text-slate-400">Images Per Page</label>
                                      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted dark:bg-slate-700 p-1 mt-1">
                                          {( [1, 2, 4] as ImagesPerPage[]).map(num => (
                                              <button key={num} onClick={() => setImagesPerPage(num)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${imagesPerPage === num ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}>{num}</button>
                                          ))}
                                      </div>
                                  </div>
                              )}
                               <div>
                                  <label htmlFor="margins" className="flex justify-between text-xs font-medium text-muted-foreground dark:text-slate-400">Page Margins <span>{pageMargins}pt</span></label>
                                  <input id="margins" type="range" min="0" max="100" value={pageMargins} onChange={e => setPageMargins(Number(e.target.value))} className="w-full h-2 bg-muted dark:bg-slate-600 rounded-lg appearance-none cursor-pointer mt-1" />
                              </div>
                          </div>
                      </OptionGroup>
                  </div>
                  {/* Right Column: Styling & Action */}
                  <div className="space-y-4">
                      {isTextMode ? (
                        <OptionGroup title="Text Style">
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground dark:text-slate-400">Font</label>
                                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted dark:bg-slate-700 p-1 mt-1">
                                        <button onClick={() => setFontType('Courier')} className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${fontType === 'Courier' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}>Courier</button>
                                        <button onClick={() => setFontType('Helvetica')} className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${fontType === 'Helvetica' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}>Helvetica</button>
                                        <button onClick={() => setFontType('Times')} className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${fontType === 'Times' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}>Times</button>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="fontsize" className="flex justify-between text-xs font-medium text-muted-foreground dark:text-slate-400">Font Size <span>{fontSize}px</span></label>
                                    <input id="fontsize" type="range" min="8" max="24" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-full h-2 bg-muted dark:bg-slate-600 rounded-lg appearance-none cursor-pointer mt-1" />
                                </div>
                            </div>
                        </OptionGroup>
                      ) : (
                          <OptionGroup title="Styling" disabled={isPdfMergeMode}>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="bgcolor" className="text-xs font-medium text-muted-foreground dark:text-slate-400">Background Color</label>
                                    <input id="bgcolor" type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className="w-8 h-8 p-0 border-none rounded-md cursor-pointer bg-card dark:bg-slate-700" />
                                </div>
                                <div>
                                    <label htmlFor="watermarkText" className="text-xs font-medium text-muted-foreground dark:text-slate-400">Text Watermark</label>
                                    <input id="watermarkText" type="text" placeholder="e.g., DRAFT" value={watermarkText} onChange={e => setWatermarkText(e.target.value)} className="mt-1 w-full px-3 py-1.5 text-sm bg-secondary dark:bg-slate-700 border rounded-md dark:border-slate-600" />
                                    {watermarkText && <input type="range" min="0.05" max="1" step="0.05" value={watermarkOpacity} onChange={e => setWatermarkOpacity(Number(e.target.value))} className="w-full h-2 bg-muted dark:bg-slate-600 rounded-lg appearance-none cursor-pointer mt-2" />}
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground dark:text-slate-400">Image Watermark</label>
                                    {watermarkImage ? (
                                        <div className="flex items-center justify-between text-sm p-2 mt-1 border rounded-lg bg-secondary dark:bg-slate-700 dark:border-slate-600">
                                        <div className="flex items-center min-w-0">
                                            <img src={watermarkImage.previewUrl} className="w-6 h-6 mr-2 rounded-sm object-contain" />
                                            <span className="truncate" title={watermarkImage.file.name}>{watermarkImage.file.name}</span>
                                        </div>
                                        <button onClick={() => setWatermarkImage(null)} className="p-1 rounded-full hover:bg-muted dark:hover:bg-slate-600 ml-2" aria-label="Remove watermark image">
                                            <XCircleIcon className="w-4 h-4 text-destructive" />
                                        </button>
                                        </div>
                                    ) : (
                                        <label className="flex items-center justify-center w-full px-4 py-2 mt-1 text-sm border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent dark:border-slate-600 dark:hover:bg-slate-700">
                                            <span className="text-primary dark:text-slate-200 font-medium">Choose an image...</span>
                                            <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleWatermarkImageChange} />
                                        </label>
                                    )}
                                    {watermarkImage && <input type="range" min="0.05" max="1" step="0.05" value={watermarkImageOpacity} onChange={e => setWatermarkImageOpacity(Number(e.target.value))} className="w-full h-2 bg-muted dark:bg-slate-600 rounded-lg appearance-none cursor-pointer mt-2" />}
                                </div>
                            </div>
                        </OptionGroup>
                      )}
                      
                       <OptionGroup title="Quality" disabled={isPdfMergeMode || isTextMode}>
                         <div role="radiogroup" className="grid grid-cols-2 gap-2 rounded-lg bg-muted dark:bg-slate-700 p-1">
                          <button role="radio" aria-checked={pdfQuality === 'Standard'} onClick={() => setPdfQuality('Standard')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${pdfQuality === 'Standard' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}>Standard</button>
                          <button role="radio" aria-checked={pdfQuality === 'High'} onClick={() => setPdfQuality('High')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${pdfQuality === 'High' ? 'bg-primary text-primary-foreground shadow-sm dark:bg-slate-50 dark:text-slate-900' : 'hover:bg-accent dark:hover:bg-slate-600'}`}>High</button>
                        </div>
                       </OptionGroup>
                  </div>
                </div>

                <div className="pt-2">
                  <label htmlFor="outputFilename" className="block mb-2 text-sm font-semibold text-muted-foreground dark:text-slate-300">
                    Output Filename (optional)
                  </label>
                  <input
                    id="outputFilename"
                    type="text"
                    placeholder={placeholderFilename}
                    value={outputFilename}
                    onChange={(e) => setOutputFilename(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-secondary dark:bg-slate-700 border rounded-md dark:border-slate-600 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors"
                    aria-label="Output PDF filename"
                  />
                </div>

                <div className="pt-4">
                  <button onClick={generatePdf} disabled={isGenerating || (isPdfMergeMode ? pdfFiles.length < 2 : (isTextMode ? txtFiles.length === 0 : files.length === 0))} className="flex items-center justify-center w-full px-6 py-3 text-base font-semibold text-primary-foreground bg-primary rounded-lg shadow-md hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-400">
                      {isGenerating ? 'Generating PDF...' : 'Generate PDF'}
                  </button>
                </div>
                
                {isGenerating && (
                  <div className="w-full max-w-md text-center mx-auto mt-4" aria-live="polite" aria-atomic="true">
                    <div className="w-full bg-muted dark:bg-slate-700 rounded-full h-2.5 mb-2 overflow-hidden">
                        <div className="bg-primary dark:bg-slate-300 h-2.5 rounded-full transition-all duration-300 ease-linear" style={{ width: `${progress}%` }} role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="PDF generation progress"></div>
                    </div>
                    <p className="text-sm text-muted-foreground dark:text-slate-400 truncate" title={progressMessage}>{progressMessage}</p>
                    <p className="font-semibold text-primary dark:text-slate-200">{Math.round(progress)}%</p>
                  </div>
                )}
            </div>
        </main>
        
        <footer className="text-center mt-12">
            <p className="text-sm text-muted-foreground dark:text-slate-500">
                Powered by React & pdf-lib. All processing is done locally in your browser.
            </p>
        </footer>
      </div>
      {fileToConvert && <SvgConverterModal file={fileToConvert} onClose={handleCloseConverter} />}
    </div>
  );
};

export default App;