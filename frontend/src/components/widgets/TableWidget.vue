<template>
  <div class="table-widget">
    <div v-if="widget.title" class="widget-title">{{ widget.title }}</div>
    <div v-if="widget.description" class="widget-description">{{ widget.description }}</div>
    
    <div class="table-container">
      <table class="widget-table">
        <thead>
          <tr>
            <th v-if="widget.selectable" class="checkbox-column">
              <input
                type="checkbox"
                :checked="isAllSelected"
                @change="toggleSelectAll"
              />
            </th>
            <th
              v-for="column in widget.columns"
              :key="column.key"
              :style="{ width: column.width, textAlign: column.align || 'left' }"
              :class="{ sortable: column.sortable }"
              @click="column.sortable && handleSort(column.key)"
            >
              {{ column.label }}
              <span v-if="column.sortable" class="sort-indicator">
                {{ getSortIndicator(column.key) }}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in displayedRows"
            :key="index"
            :class="{ selected: selectedRows.includes(index) }"
          >
            <td v-if="widget.selectable" class="checkbox-column">
              <input
                type="checkbox"
                :checked="selectedRows.includes(index)"
                @change="toggleRowSelection(index)"
              />
            </td>
            <td
              v-for="column in widget.columns"
              :key="column.key"
              :style="{ textAlign: column.align || 'left' }"
            >
              {{ row[column.key] }}
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="widget.pagination?.enabled" class="pagination">
        <button
          @click="currentPage--"
          :disabled="currentPage === 1"
          class="pagination-btn"
        >
          Previous
        </button>
        <span class="pagination-info">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button
          @click="currentPage++"
          :disabled="currentPage === totalPages"
          class="pagination-btn"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { TableWidget, WidgetEvent } from '@/types/widget';

interface Props {
  widget: TableWidget;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  change: [event: WidgetEvent];
}>();

const selectedRows = ref<number[]>([]);
const sortColumn = ref<string | null>(null);
const sortDirection = ref<'asc' | 'desc'>('asc');
const currentPage = ref(props.widget.pagination?.currentPage || 1);

const sortedRows = computed(() => {
  if (!sortColumn.value) return props.widget.rows;
  
  return [...props.widget.rows].sort((a, b) => {
    const aVal = a[sortColumn.value!];
    const bVal = b[sortColumn.value!];
    
    if (aVal < bVal) return sortDirection.value === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection.value === 'asc' ? 1 : -1;
    return 0;
  });
});

const displayedRows = computed(() => {
  if (!props.widget.pagination?.enabled) return sortedRows.value;
  
  const pageSize = props.widget.pagination.pageSize;
  const start = (currentPage.value - 1) * pageSize;
  const end = start + pageSize;
  
  return sortedRows.value.slice(start, end);
});

const totalPages = computed(() => {
  if (!props.widget.pagination?.enabled) return 1;
  return Math.ceil(props.widget.rows.length / props.widget.pagination.pageSize);
});

const isAllSelected = computed(() => {
  return displayedRows.value.length > 0 && 
         selectedRows.value.length === displayedRows.value.length;
});

const handleSort = (column: string) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortDirection.value = 'asc';
  }
};

const getSortIndicator = (column: string) => {
  if (sortColumn.value !== column) return '↕';
  return sortDirection.value === 'asc' ? '↑' : '↓';
};

const toggleRowSelection = (index: number) => {
  const idx = selectedRows.value.indexOf(index);
  if (idx > -1) {
    selectedRows.value.splice(idx, 1);
  } else {
    selectedRows.value.push(index);
  }
  emitSelection();
};

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedRows.value = [];
  } else {
    selectedRows.value = displayedRows.value.map((_, index) => index);
  }
  emitSelection();
};

const emitSelection = () => {
  const event: WidgetEvent = {
    widgetId: props.widget.id,
    type: 'change',
    value: selectedRows.value.map(idx => displayedRows.value[idx]),
    metadata: {
      selectedCount: selectedRows.value.length
    }
  };
  emit('change', event);
};
</script>

<style scoped lang="scss">
.table-widget {
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
  
  .table-container {
    overflow-x: auto;
  }
  
  .widget-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    
    thead {
      background: var(--color-background-mute);
      
      th {
        padding: 0.75rem;
        text-align: left;
        font-weight: 600;
        color: var(--color-heading);
        border-bottom: 2px solid var(--color-border);
        
        &.sortable {
          cursor: pointer;
          user-select: none;
          
          &:hover {
            background: var(--color-background-soft);
          }
        }
        
        .sort-indicator {
          margin-left: 0.5rem;
          color: var(--color-text-secondary);
        }
      }
    }
    
    tbody {
      tr {
        border-bottom: 1px solid var(--color-border);
        transition: background 0.2s;
        
        &:hover {
          background: var(--color-background-mute);
        }
        
        &.selected {
          background: var(--color-primary-soft);
        }
      }
      
      td {
        padding: 0.75rem;
        color: var(--color-text);
      }
    }
    
    .checkbox-column {
      width: 40px;
      text-align: center;
    }
  }
  
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
    
    .pagination-btn {
      padding: 0.5rem 1rem;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: opacity 0.2s;
      
      &:hover:not(:disabled) {
        opacity: 0.8;
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
    
    .pagination-info {
      color: var(--color-text-secondary);
      font-size: 0.875rem;
    }
  }
}
</style>