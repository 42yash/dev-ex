<template>
  <div class="file-upload-widget">
    <div v-if="widget.title" class="widget-title">{{ widget.title }}</div>
    <div v-if="widget.description" class="widget-description">{{ widget.description }}</div>
    
    <div 
      class="upload-area"
      :class="{ 'dragging': isDragging }"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @click="triggerFileInput"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="widget.accept"
        :multiple="widget.multiple"
        @change="handleFileSelect"
        style="display: none"
      />
      
      <div v-if="!uploadedFiles.length" class="upload-placeholder">
        <svg class="upload-icon" viewBox="0 0 24 24" width="48" height="48">
          <path fill="currentColor" d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z" />
        </svg>
        <p class="upload-text">
          {{ isDragging ? 'Drop files here' : 'Click or drag files to upload' }}
        </p>
        <p class="upload-hint">
          {{ getAcceptHint() }}
          <span v-if="widget.maxSize"> • Max size: {{ formatBytes(widget.maxSize) }}</span>
        </p>
      </div>
      
      <div v-else class="uploaded-files">
        <div v-for="file in uploadedFiles" :key="file.id" class="file-item">
          <div class="file-icon">{{ getFileIcon(file.type) }}</div>
          <div class="file-info">
            <div class="file-name">{{ file.name }}</div>
            <div class="file-meta">
              {{ formatBytes(file.size) }}
              <span v-if="file.progress !== undefined && file.progress < 100">
                • {{ file.progress }}%
              </span>
            </div>
          </div>
          <button 
            class="file-remove" 
            @click.stop="removeFile(file.id)"
            title="Remove file"
          >
            ✕
          </button>
        </div>
        
        <button 
          v-if="widget.multiple" 
          class="add-more-btn"
          @click.stop="triggerFileInput"
        >
          + Add more files
        </button>
      </div>
    </div>
    
    <div v-if="uploadError" class="upload-error">
      {{ uploadError }}
    </div>
    
    <div v-if="uploadedFiles.length && widget.showUploadButton" class="upload-actions">
      <button 
        class="upload-btn"
        :disabled="isUploading"
        @click="uploadFiles"
      >
        {{ isUploading ? 'Uploading...' : 'Upload Files' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { FileUploadWidget } from '@/types/widget';

interface Props {
  widget: FileUploadWidget;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  progress?: number;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:value', 'upload']);

const fileInput = ref<HTMLInputElement>();
const isDragging = ref(false);
const uploadedFiles = ref<UploadedFile[]>([]);
const uploadError = ref('');
const isUploading = ref(false);

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = true;
};

const handleDragLeave = () => {
  isDragging.value = false;
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
  
  if (e.dataTransfer?.files) {
    handleFiles(Array.from(e.dataTransfer.files));
  }
};

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    handleFiles(Array.from(target.files));
  }
};

const handleFiles = (files: File[]) => {
  uploadError.value = '';
  
  // Validate files
  for (const file of files) {
    // Check file type
    if (props.widget.accept && !isAcceptedType(file)) {
      uploadError.value = `File type not accepted: ${file.name}`;
      return;
    }
    
    // Check file size
    if (props.widget.maxSize && file.size > props.widget.maxSize) {
      uploadError.value = `File too large: ${file.name} (max ${formatBytes(props.widget.maxSize)})`;
      return;
    }
  }
  
  // Add files to list
  if (!props.widget.multiple) {
    uploadedFiles.value = [];
  }
  
  for (const file of files) {
    if (!props.widget.multiple && uploadedFiles.value.length > 0) {
      break;
    }
    
    const uploadedFile: UploadedFile = {
      id: generateId(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
      progress: 0
    };
    
    uploadedFiles.value.push(uploadedFile);
  }
  
  // Auto-upload if configured
  if (props.widget.autoUpload) {
    uploadFiles();
  }
  
  // Emit value update
  emit('update:value', uploadedFiles.value.map(f => f.file));
};

const isAcceptedType = (file: File): boolean => {
  if (!props.widget.accept) return true;
  
  const accepts = props.widget.accept.split(',').map(a => a.trim());
  
  for (const accept of accepts) {
    if (accept.startsWith('.')) {
      // Extension check
      if (file.name.toLowerCase().endsWith(accept.toLowerCase())) {
        return true;
      }
    } else if (accept.includes('*')) {
      // MIME type with wildcard
      const [type, subtype] = accept.split('/');
      const [fileType] = file.type.split('/');
      if (type === fileType || type === '*') {
        return true;
      }
    } else {
      // Exact MIME type
      if (file.type === accept) {
        return true;
      }
    }
  }
  
  return false;
};

const removeFile = (id: string) => {
  uploadedFiles.value = uploadedFiles.value.filter(f => f.id !== id);
  emit('update:value', uploadedFiles.value.map(f => f.file));
};

const uploadFiles = async () => {
  if (!uploadedFiles.value.length) return;
  
  isUploading.value = true;
  uploadError.value = '';
  
  try {
    // Simulate upload with progress
    for (const file of uploadedFiles.value) {
      // In production, this would upload to the actual endpoint
      await simulateUpload(file);
    }
    
    // Emit upload event
    emit('upload', uploadedFiles.value.map(f => f.file));
    
    // Clear files after successful upload
    if (props.widget.clearAfterUpload) {
      uploadedFiles.value = [];
    }
  } catch (error) {
    uploadError.value = 'Upload failed. Please try again.';
  } finally {
    isUploading.value = false;
  }
};

const simulateUpload = (file: UploadedFile): Promise<void> => {
  return new Promise((resolve) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      file.progress = progress;
      
      if (progress >= 100) {
        clearInterval(interval);
        resolve();
      }
    }, 200);
  });
};

const getAcceptHint = (): string => {
  if (!props.widget.accept) return 'All file types accepted';
  
  const accepts = props.widget.accept.split(',').map(a => a.trim());
  const extensions = accepts.filter(a => a.startsWith('.')).map(a => a.toUpperCase().slice(1));
  const mimeTypes = accepts.filter(a => !a.startsWith('.'));
  
  const hints: string[] = [];
  if (extensions.length) {
    hints.push(extensions.join(', '));
  }
  if (mimeTypes.length) {
    const types = mimeTypes.map(m => {
      if (m === 'image/*') return 'Images';
      if (m === 'video/*') return 'Videos';
      if (m === 'audio/*') return 'Audio';
      if (m === 'application/pdf') return 'PDF';
      return m;
    });
    hints.push(types.join(', '));
  }
  
  return hints.join(' • ');
};

const getFileIcon = (type: string): string => {
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎥';
  if (type.startsWith('audio/')) return '🎵';
  if (type === 'application/pdf') return '📄';
  if (type.includes('zip') || type.includes('rar')) return '📦';
  if (type.includes('word')) return '📝';
  if (type.includes('excel') || type.includes('sheet')) return '📊';
  if (type.includes('powerpoint') || type.includes('presentation')) return '📊';
  return '📎';
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};
</script>

<style scoped lang="scss">
.file-upload-widget {
  padding: 1rem;
  background: var(--color-background-soft);
  border-radius: 8px;
  
  .widget-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--color-heading);
  }
  
  .widget-description {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    margin-bottom: 1rem;
  }
  
  .upload-area {
    border: 2px dashed var(--color-border);
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: var(--color-background);
    
    &:hover {
      border-color: var(--color-primary);
      background: var(--color-background-soft);
    }
    
    &.dragging {
      border-color: var(--color-primary);
      background: var(--color-primary-soft);
      transform: scale(1.02);
    }
  }
  
  .upload-placeholder {
    .upload-icon {
      color: var(--color-text-secondary);
      margin-bottom: 1rem;
    }
    
    .upload-text {
      font-size: 1rem;
      color: var(--color-text);
      margin-bottom: 0.5rem;
    }
    
    .upload-hint {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
    }
  }
  
  .uploaded-files {
    text-align: left;
    
    .file-item {
      display: flex;
      align-items: center;
      padding: 0.75rem;
      background: var(--color-background-soft);
      border-radius: 6px;
      margin-bottom: 0.5rem;
      
      .file-icon {
        font-size: 1.5rem;
        margin-right: 0.75rem;
      }
      
      .file-info {
        flex: 1;
        
        .file-name {
          font-weight: 500;
          color: var(--color-text);
          margin-bottom: 0.25rem;
        }
        
        .file-meta {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }
      }
      
      .file-remove {
        background: none;
        border: none;
        color: var(--color-text-secondary);
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0.25rem 0.5rem;
        transition: color 0.2s;
        
        &:hover {
          color: var(--color-danger);
        }
      }
    }
    
    .add-more-btn {
      width: 100%;
      padding: 0.5rem;
      background: none;
      border: 1px dashed var(--color-border);
      border-radius: 6px;
      color: var(--color-primary);
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background: var(--color-primary-soft);
        border-color: var(--color-primary);
      }
    }
  }
  
  .upload-error {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--color-danger-soft);
    color: var(--color-danger);
    border-radius: 4px;
    font-size: 0.875rem;
  }
  
  .upload-actions {
    margin-top: 1rem;
    
    .upload-btn {
      width: 100%;
      padding: 0.75rem;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
      
      &:hover:not(:disabled) {
        opacity: 0.9;
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
}
</style>