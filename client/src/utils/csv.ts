/**
 * Generate CSV file from metadata
 * Adobe Stock format: Filename, Title, Keywords, Category, Releases
 */
export function generateCSV(
  images: Array<{
    filename: string;
    title?: string;
    keywords?: string;
    category?: number;
  }>,
  initials: string
): string {
  const headers = ['Filename', 'Title', 'Keywords', 'Category', 'Releases'];
  const rows = images
    .filter(img => img.title && img.keywords && img.category)
    .map(img => {
      return [
        `"${img.filename.replace(/"/g, '""')}"`,
        `"${(img.title ?? '').replace(/"/g, '""')}"`,
        `"${(img.keywords ?? '').replace(/"/g, '""')}"`,
        img.category?.toString() || '',
        `"${initials.replace(/"/g, '""')}"`,
      ].join(',');
    });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
