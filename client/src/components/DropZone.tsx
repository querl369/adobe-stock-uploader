import React from 'react';
import { useDrop } from 'react-dnd';

export function DropZone({
  children,
  onFileDrop,
  disabled,
}: {
  children: React.ReactNode;
  onFileDrop: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: ['__NATIVE_FILE__'],
      drop: (_item: unknown, monitor) => {
        const files = monitor.getItem()?.files;
        if (files) {
          onFileDrop(Array.from(files));
        }
      },
      collect: monitor => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    [onFileDrop]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileDrop(files);
    }
  };

  return (
    <div
      ref={drop}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="min-h-screen flex flex-col items-center p-8 transition-all duration-300"
      style={{ backgroundColor: isOver && !disabled ? 'rgba(0, 0, 0, 0.02)' : 'transparent' }}
    >
      {children}
    </div>
  );
}
