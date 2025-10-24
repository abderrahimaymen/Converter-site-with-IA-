import React, { useState } from 'react';
import { AppFile } from '../types';
import TrashIcon from './icons/TrashIcon';
import GripVerticalIcon from './icons/GripVerticalIcon';
import MagicWandIcon from './icons/MagicWandIcon';

interface ImageListProps {
  files: AppFile[];
  onRemoveFile: (id: string) => void;
  onReorderFiles: (files: AppFile[]) => void;
  onConvertToSvg: (id: string) => void;
}

const ImageList: React.FC<ImageListProps> = ({ files, onRemoveFile, onReorderFiles, onConvertToSvg }) => {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItemId(id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLLIElement>, targetId: string) => {
    e.preventDefault();
    if (draggedItemId === null || draggedItemId === targetId) {
      setDraggedItemId(null);
      return;
    }

    const draggedIndex = files.findIndex((file) => file.id === draggedItemId);
    const targetIndex = files.findIndex((file) => file.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newFiles = [...files];
    const [draggedItem] = newFiles.splice(draggedIndex, 1);
    newFiles.splice(targetIndex, 0, draggedItem);
    
    onReorderFiles(newFiles);
    setDraggedItemId(null);
  };

  return (
    <ul className="space-y-3">
      {files.map((file) => (
        <li
          key={file.id}
          draggable
          onDragStart={(e) => handleDragStart(e, file.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, file.id)}
          className={`flex items-center p-3 rounded-lg border bg-card text-card-foreground transition-shadow duration-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-50 ${
            draggedItemId === file.id ? 'shadow-2xl opacity-50' : 'shadow-sm'
          }`}
        >
          <GripVerticalIcon className="w-5 h-5 mr-3 text-muted-foreground dark:text-slate-400 cursor-grab" />
          <img
            src={file.previewUrl}
            alt={file.file.name}
            className="w-12 h-12 object-cover rounded-md mr-4 border dark:border-slate-600"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.file.name}</p>
            <p className="text-xs text-muted-foreground dark:text-slate-400">
              {Math.round(file.file.size / 1024)} KB
            </p>
          </div>
          <div className="flex items-center ml-4">
            <button
                onClick={() => onConvertToSvg(file.id)}
                className="p-2 rounded-full text-muted-foreground hover:bg-accent hover:text-primary transition-colors dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label="Convert to SVG"
                title="Convert to SVG"
            >
                <MagicWandIcon className="w-5 h-5" />
            </button>
            <button
                onClick={() => onRemoveFile(file.id)}
                className="p-2 rounded-full text-muted-foreground hover:bg-accent hover:text-destructive transition-colors dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-red-500"
                aria-label="Remove file"
            >
                <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default ImageList;