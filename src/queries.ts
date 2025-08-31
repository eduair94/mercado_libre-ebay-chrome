import AIQueryManager from './classes/AIQueryManager';
import { AIQuery } from './interfaces/products.interface';

interface Translations {
  [language: string]: {
    [key: string]: string;
  };
}

class QueryManagerController {
  private currentPage: number = 1;
  private itemsPerPage: number = 10;
  private filteredQueries: AIQuery[] = [];
  private allQueries: AIQuery[] = [];
  private currentLanguage: string = 'es';
  private editingQueryId: string | null = null;

  // Embedded translations to avoid async loading issues
  private translations: Translations = {
    es: {
      queryManagementTitle: "Gestión de Consultas IA",
      queryManagementDescription: "Administra las consultas optimizadas con inteligencia artificial",
      queryStatsTitle: "Estadísticas de Consultas",
      totalQueriesLabel: "Total",
      cachedQueriesLabel: "En Caché", 
      savedTokensLabel: "Tokens Ahorrados",
      avgTokensSavedLabel: "Promedio/Consulta",
      queryListTitle: "Lista de Consultas",
      searchQueriesPlaceholder: "Buscar consultas...",
      allSources: "Todas las fuentes",
      geminiSource: "Gemini",
      manualSource: "Manual",
      sortByLastUsed: "Último uso",
      sortByUsageCount: "Más usadas",
      sortByCreated: "Fecha creación",
      sortByTokens: "Tokens ahorrados",
      originalQueryLabel: "Consulta Original",
      optimizedQueryLabel: "Consulta Optimizada",
      sourceLabel: "Fuente",
      usageCountLabel: "Usos",
      tokensSavedLabel: "Tokens",
      lastUsedLabel: "Último Uso",
      actionsLabel: "Acciones",
      editButton: "Editar",
      deleteButton: "Eliminar",
      exportButton: "Exportar",
      refreshButton: "Actualizar",
      clearAllButton: "Limpiar Todo",
      showingResults: "Mostrando",
      ofTotal: "de",
      queries: "consultas",
      noQueriesTitle: "No hay consultas guardadas",
      noQueriesMessage: "Las consultas optimizadas aparecerán aquí cuando uses la búsqueda con IA",
      editQueryTitle: "Editar Consulta",
      cancelButton: "Cancelar",
      saveButton: "Guardar",
      itemsPerPage: "Elementos por página:",
      prevButton: "Anterior",
      nextButton: "Siguiente",
      loadingQueries: "Cargando consultas...",
      confirmDelete: "¿Estás seguro de que quieres eliminar esta consulta?",
      confirmClearAll: "¿Estás seguro de que quieres eliminar todas las consultas? Esta acción no se puede deshacer.",
      queryDeleted: "Consulta eliminada",
      queriesCleared: "Todas las consultas han sido eliminadas",
      queryUpdated: "Consulta actualizada",
      queriesExported: "Consultas exportadas exitosamente",
      exportError: "Error al exportar consultas",
      deleteError: "Error al eliminar consulta",
      updateError: "Error al actualizar consulta",
      loadError: "Error al cargar consultas"
    },
    pt: {
      queryManagementTitle: "Gestão de Consultas IA",
      queryManagementDescription: "Administre as consultas otimizadas com inteligência artificial",
      queryStatsTitle: "Estatísticas de Consultas",
      totalQueriesLabel: "Total",
      cachedQueriesLabel: "Em Cache",
      savedTokensLabel: "Tokens Economizados",
      avgTokensSavedLabel: "Média/Consulta",
      queryListTitle: "Lista de Consultas",
      searchQueriesPlaceholder: "Buscar consultas...",
      allSources: "Todas as fontes",
      geminiSource: "Gemini",
      manualSource: "Manual",
      sortByLastUsed: "Último uso",
      sortByUsageCount: "Mais usadas",
      sortByCreated: "Data criação",
      sortByTokens: "Tokens economizados",
      originalQueryLabel: "Consulta Original",
      optimizedQueryLabel: "Consulta Otimizada",
      sourceLabel: "Fonte",
      usageCountLabel: "Usos",
      tokensSavedLabel: "Tokens",
      lastUsedLabel: "Último Uso",
      actionsLabel: "Ações",
      editButton: "Editar",
      deleteButton: "Excluir",
      exportButton: "Exportar",
      refreshButton: "Atualizar",
      clearAllButton: "Limpar Tudo",
      showingResults: "Mostrando",
      ofTotal: "de",
      queries: "consultas",
      noQueriesTitle: "Nenhuma consulta salva",
      noQueriesMessage: "As consultas otimizadas aparecerão aqui quando você usar a busca com IA",
      editQueryTitle: "Editar Consulta",
      cancelButton: "Cancelar",
      saveButton: "Salvar",
      itemsPerPage: "Itens por página:",
      prevButton: "Anterior",
      nextButton: "Próximo",
      loadingQueries: "Carregando consultas...",
      confirmDelete: "Tem certeza de que deseja excluir esta consulta?",
      confirmClearAll: "Tem certeza de que deseja excluir todas as consultas? Esta ação não pode ser desfeita.",
      queryDeleted: "Consulta excluída",
      queriesCleared: "Todas as consultas foram removidas",
      queryUpdated: "Consulta atualizada",
      queriesExported: "Consultas exportadas com sucesso",
      exportError: "Erro ao exportar consultas",
      deleteError: "Erro ao excluir consulta",
      updateError: "Erro ao atualizar consulta",
      loadError: "Erro ao carregar consultas"
    }
  };

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadLanguage();
    this.setupEventListeners();
    this.updateTextContent();
    await this.loadQueryStats();
    await this.loadQueryList();
  }

  private async loadLanguage(): Promise<void> {
    try {
      const result = await new Promise<{ [key: string]: any }>((resolve) => {
        chrome.storage.sync.get(["extensionConfig"], resolve);
      });

      if (result.extensionConfig && result.extensionConfig.language) {
        this.currentLanguage = result.extensionConfig.language;
      }
    } catch (error) {
      console.warn("Failed to load language setting:", error);
    }
  }

  private updateTextContent(): void {
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((element) => {
      const key = element.getAttribute("data-i18n");
      if (key) {
        const translation = this.getTranslation(key);
        element.textContent = translation;
      }
    });

    // Update placeholders
    const placeholderElements = document.querySelectorAll("[data-i18n-placeholder]");
    placeholderElements.forEach((element) => {
      const key = element.getAttribute("data-i18n-placeholder");
      if (key) {
        const translation = this.getTranslation(key);
        (element as HTMLInputElement).placeholder = translation;
      }
    });
  }

  private getTranslation(key: string): string {
    return this.translations[this.currentLanguage]?.[key] || key;
  }

  private setupEventListeners(): void {
    // Window controls
    const closeWindow = document.getElementById("closeWindow");
    closeWindow?.addEventListener("click", () => {
      window.close();
    });

    // Search and filter controls
    const querySearch = document.getElementById("querySearch") as HTMLInputElement;
    querySearch?.addEventListener("input", (e) => {
      this.filterQueries((e.target as HTMLInputElement).value);
    });

    const sourceFilter = document.getElementById("sourceFilter") as HTMLSelectElement;
    sourceFilter?.addEventListener("change", () => {
      this.applyFilters();
    });

    const sortBy = document.getElementById("sortBy") as HTMLSelectElement;
    sortBy?.addEventListener("change", () => {
      this.applySorting();
    });

    const itemsPerPage = document.getElementById("itemsPerPage") as HTMLSelectElement;
    itemsPerPage?.addEventListener("change", (e) => {
      this.itemsPerPage = parseInt((e.target as HTMLSelectElement).value);
      this.currentPage = 1;
      this.renderQueryList();
    });

    // Action buttons
    const exportQueries = document.getElementById("exportQueries");
    exportQueries?.addEventListener("click", () => {
      this.exportQueries();
    });

    const refreshQueries = document.getElementById("refreshQueries");
    refreshQueries?.addEventListener("click", () => {
      this.loadQueryList();
    });

    const clearAllQueries = document.getElementById("clearAllQueries");
    clearAllQueries?.addEventListener("click", () => {
      this.confirmClearAllQueries();
    });

    // Pagination
    const prevPage = document.getElementById("prevPage");
    prevPage?.addEventListener("click", () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderQueryList();
      }
    });

    const nextPage = document.getElementById("nextPage");
    nextPage?.addEventListener("click", () => {
      const totalPages = Math.ceil(this.filteredQueries.length / this.itemsPerPage);
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderQueryList();
      }
    });

    // Modal controls
    const closeModal = document.getElementById("closeModal");
    closeModal?.addEventListener("click", () => {
      this.closeEditModal();
    });

    const cancelEdit = document.getElementById("cancelEdit");
    cancelEdit?.addEventListener("click", () => {
      this.closeEditModal();
    });

    const saveEdit = document.getElementById("saveEdit");
    saveEdit?.addEventListener("click", () => {
      this.saveEditedQuery();
    });

    // Close modal when clicking outside
    const editModal = document.getElementById("editModal");
    editModal?.addEventListener("click", (e) => {
      if (e.target === editModal) {
        this.closeEditModal();
      }
    });
  }

  private async loadQueryStats(): Promise<void> {
    try {
      const stats = await AIQueryManager.getStats();
      
      const totalQueriesEl = document.getElementById("totalQueries");
      const cachedQueriesEl = document.getElementById("cachedQueries");
      const savedTokensEl = document.getElementById("savedTokens");
      const avgTokensSavedEl = document.getElementById("avgTokensSaved");

      if (totalQueriesEl) totalQueriesEl.textContent = stats.totalQueries.toString();
      if (cachedQueriesEl) cachedQueriesEl.textContent = stats.cachedQueries.toString();
      if (savedTokensEl) savedTokensEl.textContent = stats.totalTokensSaved.toString();
      if (avgTokensSavedEl) {
        const avg = stats.totalQueries > 0 ? Math.round(stats.totalTokensSaved / stats.totalQueries) : 0;
        avgTokensSavedEl.textContent = avg.toString();
      }
    } catch (error) {
      console.error("Failed to load query stats:", error);
    }
  }

  private async loadQueryList(): Promise<void> {
    console.log("Load queries");
    this.showLoading(true);
    
    try {
      this.allQueries = await AIQueryManager.getAllQueries();
      this.filteredQueries = [...this.allQueries];
      this.applySorting();
      this.renderQueryList();
      await this.loadQueryStats(); // Refresh stats too
    } catch (error) {
      console.error("Failed to load queries:", error);
      this.showToast(this.getTranslation("loadError"), "error");
    } finally {
      this.showLoading(false);
    }
  }

  private applyFilters(): void {
    const searchInput = document.getElementById("querySearch") as HTMLInputElement;
    const sourceFilter = document.getElementById("sourceFilter") as HTMLSelectElement;
    
    const searchTerm = searchInput?.value.toLowerCase() || "";
    const sourceValue = sourceFilter?.value || "all";

    this.filteredQueries = this.allQueries.filter(query => {
      const matchesSearch = !searchTerm || 
        query.originalQuery.toLowerCase().includes(searchTerm) ||
        query.optimizedQuery.toLowerCase().includes(searchTerm);
      
      const matchesSource = sourceValue === "all" || query.source === sourceValue;
      
      return matchesSearch && matchesSource;
    });

    this.currentPage = 1;
    this.applySorting();
  }

  private filterQueries(searchTerm: string): void {
    this.applyFilters();
    this.renderQueryList();
  }

  private applySorting(): void {
    const sortBy = document.getElementById("sortBy") as HTMLSelectElement;
    const sortValue = sortBy?.value || "lastUsed";

    this.filteredQueries.sort((a, b) => {
      switch (sortValue) {
        case "lastUsed":
          return b.lastUsed - a.lastUsed;
        case "usageCount":
          return b.usageCount - a.usageCount;
        case "timestamp":
          return b.timestamp - a.timestamp;
        case "tokensSaved":
          return b.tokensSaved - a.tokensSaved;
        default:
          return b.lastUsed - a.lastUsed;
      }
    });

    this.renderQueryList();
  }

  private renderQueryList(): void {
    const queryTableBody = document.getElementById("queryTableBody");
    const emptyState = document.getElementById("emptyState");
    const queryPagination = document.getElementById("queryPagination");
    const showingCount = document.getElementById("showingCount");
    const totalCount = document.getElementById("totalCount");

    if (!queryTableBody || !emptyState || !queryPagination) return;

    // Clear existing content
    queryTableBody.innerHTML = "";

    if (this.filteredQueries.length === 0) {
      emptyState.classList.remove("hidden");
      queryPagination.classList.add("hidden");
      return;
    }

    emptyState.classList.add("hidden");

    // Calculate pagination
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredQueries.length);
    const currentPageQueries = this.filteredQueries.slice(startIndex, endIndex);

    // Render queries
    currentPageQueries.forEach(query => {
      const row = this.createQueryRow(query);
      queryTableBody.appendChild(row);
    });

    // Update pagination info
    if (showingCount) showingCount.textContent = `${startIndex + 1}-${endIndex}`;
    if (totalCount) totalCount.textContent = this.filteredQueries.length.toString();

    // Show/hide pagination
    const totalPages = Math.ceil(this.filteredQueries.length / this.itemsPerPage);
    if (totalPages > 1) {
      queryPagination.classList.remove("hidden");
      this.updatePaginationButtons();
    } else {
      queryPagination.classList.add("hidden");
    }
  }

  private createQueryRow(query: AIQuery): HTMLTableRowElement {
    const row = document.createElement("tr");
    row.className = "query-item border-b border-gray-100 hover:bg-gray-50 transition-colors";

    const formatDate = (timestamp: number) => {
      return new Date(timestamp).toLocaleString(this.currentLanguage === 'es' ? 'es-ES' : 'pt-BR');
    };

    row.innerHTML = `
      <td class="py-3 px-4">
        <div class="max-w-xs truncate text-sm text-gray-800" title="${query.originalQuery}">
          ${query.originalQuery}
        </div>
      </td>
      <td class="py-3 px-4">
        <div class="max-w-xs truncate text-sm text-gray-600" title="${query.optimizedQuery}">
          ${query.optimizedQuery}
        </div>
      </td>
      <td class="py-3 px-4">
        <span class="px-2 py-1 text-xs rounded-full font-medium ${query.source === 'gemini' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}">
          ${query.source === 'gemini' ? 'Gemini' : 'Manual'}
        </span>
      </td>
      <td class="py-3 px-4">
        <span class="text-sm font-medium text-gray-800">${query.usageCount}</span>
      </td>
      <td class="py-3 px-4">
        <span class="text-sm font-medium text-green-600">${query.tokensSaved}</span>
      </td>
      <td class="py-3 px-4">
        <span class="text-xs text-gray-500">${formatDate(query.lastUsed)}</span>
      </td>
      <td class="py-3 px-4">
        <div class="flex items-center space-x-2">
          <button class="edit-query px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors" data-query-id="${query.id}">
            ${this.getTranslation("editButton")}
          </button>
          <button class="delete-query px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors" data-query-id="${query.id}">
            ${this.getTranslation("deleteButton")}
          </button>
        </div>
      </td>
    `;

    // Add event listeners to action buttons
    const editBtn = row.querySelector(".edit-query");
    const deleteBtn = row.querySelector(".delete-query");

    editBtn?.addEventListener("click", () => {
      this.openEditModal(query);
    });

    deleteBtn?.addEventListener("click", () => {
      this.confirmDeleteQuery(query.id);
    });

    return row;
  }

  private updatePaginationButtons(): void {
    const prevPage = document.getElementById("prevPage") as HTMLButtonElement;
    const nextPage = document.getElementById("nextPage") as HTMLButtonElement;
    const pageInfo = document.getElementById("pageInfo");

    const totalPages = Math.ceil(this.filteredQueries.length / this.itemsPerPage);

    if (prevPage) {
      prevPage.disabled = this.currentPage <= 1;
    }

    if (nextPage) {
      nextPage.disabled = this.currentPage >= totalPages;
    }

    if (pageInfo) {
      pageInfo.textContent = `Página ${this.currentPage} de ${totalPages}`;
    }
  }

  private openEditModal(query: AIQuery): void {
    this.editingQueryId = query.id;
    
    const modal = document.getElementById("editModal");
    const originalQueryInput = document.getElementById("editOriginalQuery") as HTMLInputElement;
    const optimizedQueryInput = document.getElementById("editOptimizedQuery") as HTMLTextAreaElement;
    const usageCountInput = document.getElementById("editUsageCount") as HTMLInputElement;
    const tokensSavedInput = document.getElementById("editTokensSaved") as HTMLInputElement;

    if (originalQueryInput) originalQueryInput.value = query.originalQuery;
    if (optimizedQueryInput) optimizedQueryInput.value = query.optimizedQuery;
    if (usageCountInput) usageCountInput.value = query.usageCount.toString();
    if (tokensSavedInput) tokensSavedInput.value = query.tokensSaved.toString();

    modal?.classList.remove("hidden");
  }

  private closeEditModal(): void {
    const modal = document.getElementById("editModal");
    modal?.classList.add("hidden");
    this.editingQueryId = null;
  }

  private async saveEditedQuery(): Promise<void> {
    if (!this.editingQueryId) return;

    const optimizedQueryInput = document.getElementById("editOptimizedQuery") as HTMLTextAreaElement;
    const usageCountInput = document.getElementById("editUsageCount") as HTMLInputElement;
    const tokensSavedInput = document.getElementById("editTokensSaved") as HTMLInputElement;

    const optimizedQuery = optimizedQueryInput?.value.trim();
    const usageCount = parseInt(usageCountInput?.value || "0");
    const tokensSaved = parseInt(tokensSavedInput?.value || "0");

    if (!optimizedQuery) {
      this.showToast("La consulta optimizada no puede estar vacía", "error");
      return;
    }

    try {
      const query = this.allQueries.find(q => q.id === this.editingQueryId);
      if (query) {
        query.optimizedQuery = optimizedQuery;
        query.usageCount = usageCount;
        query.tokensSaved = tokensSaved;
        
        await AIQueryManager.updateQuery(query);
        await this.loadQueryList();
        this.closeEditModal();
        this.showToast(this.getTranslation("queryUpdated"), "success");
      }
    } catch (error) {
      console.error("Failed to update query:", error);
      this.showToast(this.getTranslation("updateError"), "error");
    }
  }

  private async confirmDeleteQuery(queryId: string): Promise<void> {
    if (confirm(this.getTranslation("confirmDelete"))) {
      try {
        await AIQueryManager.deleteQuery(queryId);
        await this.loadQueryList();
        this.showToast(this.getTranslation("queryDeleted"), "success");
      } catch (error) {
        console.error("Failed to delete query:", error);
        this.showToast(this.getTranslation("deleteError"), "error");
      }
    }
  }

  private async confirmClearAllQueries(): Promise<void> {
    if (confirm(this.getTranslation("confirmClearAll"))) {
      try {
        await AIQueryManager.clearAllQueries();
        await this.loadQueryList();
        this.showToast(this.getTranslation("queriesCleared"), "success");
      } catch (error) {
        console.error("Failed to clear queries:", error);
        this.showToast(this.getTranslation("deleteError"), "error");
      }
    }
  }

  private async exportQueries(): Promise<void> {
    try {
      const queries = await AIQueryManager.getAllQueries();
      const dataStr = JSON.stringify(queries, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-queries-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      this.showToast(this.getTranslation("queriesExported"), "success");
    } catch (error) {
      console.error("Failed to export queries:", error);
      this.showToast(this.getTranslation("exportError"), "error");
    }
  }

  private showLoading(show: boolean): void {
    const loadingOverlay = document.getElementById("loadingOverlay");
    if (loadingOverlay) {
      if (show) {
        loadingOverlay.classList.remove("hidden");
      } else {
        loadingOverlay.classList.add("hidden");
      }
    }
  }

  private showToast(message: string, type: "success" | "error" | "info" = "success"): void {
    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toastMessage");

    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;

    // Set color based on type
    const colors = {
      success: "bg-green-500",
      error: "bg-red-500",
      info: "bg-blue-500",
    };

    toast.className = `fixed bottom-4 right-4 ${colors[type]} text-white p-4 rounded-lg shadow-lg transform transition-transform duration-300 ease-out`;

    // Show toast
    toast.classList.remove("hidden", "translate-y-full");
    toast.classList.add("translate-y-0");

    // Hide toast after 4 seconds
    setTimeout(() => {
      toast.classList.remove("translate-y-0");
      toast.classList.add("translate-y-full");
      setTimeout(() => {
        toast.classList.add("hidden");
      }, 300);
    }, 4000);
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  if (typeof chrome === "undefined" || !chrome.storage) {
    console.error("Chrome extension APIs not available");
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;">Extension APIs not available.</div>';
    return;
  }

  new QueryManagerController();
});
