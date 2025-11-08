// Simple vanilla TypeScript - no frameworks!
// This file handles all the UI interactions and API calls

// ============================================
// Type Definitions
// ============================================

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  path: string;
}

interface ProcessResult {
  success: boolean;
  filename: string;
  title?: string;
  keywords?: string;
  category?: string;
  error?: string;
}

interface MetadataItem {
  filename: string;
  title: string;
  keywords: string;
  category: string;
}

// ============================================
// Global State
// ============================================

let uploadedFiles: UploadedFile[] = [];
let processedResults: ProcessResult[] = [];

// ============================================
// Initialize when page loads
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  setupDragAndDrop();
  setupFileInput();
});

// ============================================
// File Upload Handlers
// ============================================

function setupDragAndDrop(): void {
  const uploadArea = document.getElementById('uploadArea');
  if (!uploadArea) return;

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop area when dragging over
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(
      eventName,
      () => {
        uploadArea.classList.add('drag-over');
      },
      false
    );
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(
      eventName,
      () => {
        uploadArea.classList.remove('drag-over');
      },
      false
    );
  });

  // Handle dropped files
  uploadArea.addEventListener('drop', handleDrop, false);
  uploadArea.addEventListener('click', () => {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.click();
  });
}

function setupFileInput(): void {
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;
  if (!fileInput) return;

  fileInput.addEventListener('change', (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      handleFiles(target.files);
    }
  });
}

function preventDefaults(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
}

function handleDrop(e: DragEvent): void {
  const dt = e.dataTransfer;
  const files = dt?.files;
  if (files) {
    handleFiles(files);
  }
}

async function handleFiles(files: FileList): Promise<void> {
  if (files.length === 0) return;

  showLoading(true);

  // Create FormData to send files to server
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('images', files[i]);
  }

  try {
    // Upload files to server
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      uploadedFiles = data.files;
      displayUploadedFiles();
    } else {
      alert('Error uploading files: ' + data.error);
    }
  } catch (error) {
    alert('Error: ' + (error as Error).message);
  } finally {
    showLoading(false);
  }
}

function displayUploadedFiles(): void {
  const filesList = document.getElementById('filesList');
  if (!filesList) return;

  if (uploadedFiles.length === 0) {
    filesList.innerHTML = '';
    return;
  }

  filesList.innerHTML = `
        <div style="margin-top: 20px; padding: 20px; background: #f0fff4; border-radius: 8px; border: 2px solid #48bb78;">
            <p style="color: #2f855a; font-weight: 600; margin-bottom: 10px;">
                ✅ ${uploadedFiles.length} file(s) uploaded successfully!
            </p>
            ${uploadedFiles
              .map(
                file => `
                <div class="file-item">
                    <div class="file-info">
                        <div class="file-icon">📷</div>
                        <div>
                            <div class="file-name">${escapeHtml(file.name)}</div>
                            <div class="file-size">${formatFileSize(file.size)}</div>
                        </div>
                    </div>
                </div>
            `
              )
              .join('')}
        </div>
    `;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Image Processing
// ============================================

async function processImages(): Promise<void> {
  if (uploadedFiles.length === 0) {
    alert('Please upload images first!');
    return;
  }

  const initialsInput = document.getElementById('initials') as HTMLInputElement;
  const initials = initialsInput?.value.trim();

  if (!initials) {
    alert('Please enter your initials!');
    initialsInput?.focus();
    return;
  }

  showLoading(true);
  showProgress(true);

  try {
    const response = await fetch('/api/process-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: uploadedFiles,
        initials: initials,
      }),
    });

    const data = await response.json();

    if (data.success) {
      processedResults = data.results;
      displayResults();
      showProgress(false);
    } else {
      alert('Error processing images: ' + data.error);
    }
  } catch (error) {
    alert('Error: ' + (error as Error).message);
  } finally {
    showLoading(false);
  }
}

function displayResults(): void {
  const resultsSection = document.getElementById('resultsSection');
  const resultsBody = document.getElementById('resultsBody');

  if (!resultsSection || !resultsBody) return;

  resultsSection.style.display = 'block';

  resultsBody.innerHTML = processedResults
    .map(
      result => `
        <tr>
            <td>${escapeHtml(result.filename)}</td>
            <td>${result.success ? escapeHtml(result.title || '-') : '-'}</td>
            <td>${result.success ? escapeHtml(result.keywords || '-') : '-'}</td>
            <td>${result.success ? escapeHtml(result.category || '-') : '-'}</td>
            <td class="${result.success ? 'status-success' : 'status-error'}">
                ${result.success ? '✅ Success' : '❌ ' + escapeHtml(result.error || 'Unknown error')}
            </td>
        </tr>
    `
    )
    .join('');

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// CSV Export
// ============================================

async function exportCSV(): Promise<void> {
  const initialsInput = document.getElementById('initials') as HTMLInputElement;
  const initials = initialsInput?.value.trim();

  // Filter only successful results
  const successfulResults = processedResults.filter(r => r.success);

  if (successfulResults.length === 0) {
    alert('No successful results to export!');
    return;
  }

  showLoading(true);

  try {
    const response = await fetch('/api/export-csv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metadata: successfulResults,
        initials: initials,
      }),
    });

    if (response.ok) {
      // Create a blob from the response and download it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${initials}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert('CSV file downloaded successfully! ✅');
    } else {
      alert('Error exporting CSV');
    }
  } catch (error) {
    alert('Error: ' + (error as Error).message);
  } finally {
    showLoading(false);
  }
}

// ============================================
// UI Helper Functions
// ============================================

function showLoading(show: boolean): void {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

function showProgress(show: boolean): void {
  const container = document.getElementById('progressContainer');
  if (!container) return;

  container.style.display = show ? 'block' : 'none';

  if (show) {
    updateProgress(0, 'Preparing...');
  }
}

function updateProgress(percent: number, text: string): void {
  const fill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  if (fill) fill.style.width = percent + '%';
  if (progressText) progressText.textContent = text;
}

function clearAll(): void {
  if (!confirm('Are you sure you want to clear all data?')) {
    return;
  }

  uploadedFiles = [];
  processedResults = [];

  const filesList = document.getElementById('filesList');
  const resultsSection = document.getElementById('resultsSection');
  const initialsInput = document.getElementById('initials') as HTMLInputElement;
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;

  if (filesList) filesList.innerHTML = '';
  if (resultsSection) resultsSection.style.display = 'none';
  if (initialsInput) initialsInput.value = '';
  if (fileInput) fileInput.value = '';

  // Clean up server files
  fetch('/api/cleanup', { method: 'POST' });
}

// Make functions available globally (for onclick handlers in HTML)
(window as any).processImages = processImages;
(window as any).exportCSV = exportCSV;
(window as any).clearAll = clearAll;
