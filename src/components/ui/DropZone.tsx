"use client";

import { useRef, useState } from "react";

type Props = {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  hint?: string;
  className?: string;
  onFiles: (files: File[]) => void;
};

export default function DropZone({ accept, multiple, disabled, label, hint, className, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onFiles(Array.from(files));
  };

  return (
    <div
      onDragOver={e => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
      }}
      onDragLeave={e => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
      }}
      onDrop={e => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => {
        if (disabled) return;
        inputRef.current?.click();
      }}
      className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer select-none ${
        dragging ? "border-accent-green bg-accent-green/10" : "border-border-light bg-base-light"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className || ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={e => {
          handleFiles(e.target.files);
          // reset so same file can be selected again
          e.target.value = "";
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <p className="text-sm font-bold pointer-events-none">
        {dragging ? "Hier ablegen…" : (label || "Datei hierher ziehen oder klicken")}
      </p>
      {hint && <p className="text-xs opacity-50 mt-1 pointer-events-none">{hint}</p>}
    </div>
  );
}