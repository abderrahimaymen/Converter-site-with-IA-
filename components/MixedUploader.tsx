import React, { useCallback, useState } from 'react';
import UploadIcon from './icons/UploadIcon';

interface MixedUploaderProps {
  onFilesAccepted: (files: File[]) => void;
  acceptPpt?: boolean;
}

const MixedUploader: React.FC<MixedUploaderProps> = ({ onFilesAccepted, acceptPpt = false }) => {
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
        onFilesAccepted(files);
      }
    },
    [onFilesAccepted]
  );
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? [...e.target.files] : [];
    if (files.length > 0) {
      onFilesAccepted(files);
    }
    e.target.value = '';
  };

  const acceptTypes = acceptPpt 
    ? "application/vnd.openxmlformats-officedocument.presentationml.presentation, .pptx" 
    : "image/png, image/jpeg, image/webp, application/pdf";

  const helperText = acceptPpt
    ? "PowerPoint presentations (.pptx)"
    : "Images (PNG, JPG, WEBP) or PDF documents";

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
        <UploadIcon className="w-10 h-10 mb-3 text-muted-foreground dark:text-slate-400" />
        <p className="mb-2 text-sm text-muted-foreground dark:text-slate-400">
          <span className="font-semibold text-primary dark:text-slate-200">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-muted-foreground dark:text-slate-500">{helperText}</p>
      </div>
      <input 
        id="mixed-dropzone-file" 
        type="file" 
        className="hidden" 
        multiple 
        accept={acceptTypes}
        onChange={handleFileChange}
      />
    </label>
  );
};

export default MixedUploader;