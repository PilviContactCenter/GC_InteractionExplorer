/**
 * Genesys Interaction Query Tool
 * JavaScript Application Logic
 * 
 * Features:
 * - CSV parsing with Papa Parse
 * - SQL-like query engine with AlaSQL
 * - Participant attribute extraction and querying
 * - Table visualization with pagination
 * - Export functionality
 */

// State Management
const AppState = {
    rawData: [],
    parsedData: [],
    columns: [],
    attributes: new Set(),
    queryResults: [],
    currentPage: 1,
    pageSize: 200,
    isLoading: false,
    // Multi-file support
    pendingFiles: [],      // Files waiting to be processed
    fileResults: [],       // Parsed results from each file
    referenceColumns: null // Columns from first file (used for validation)
};

// DOM Elements
const DOM = {
    // Upload
    uploadSection: document.getElementById('uploadSection'),
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    uploadBtn: document.getElementById('uploadBtn'),
    uploadProgress: document.getElementById('uploadProgress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),

    // File list (multi-file support)
    fileListSection: document.getElementById('fileListSection'),
    fileList: document.getElementById('fileList'),
    fileValidation: document.getElementById('fileValidation'),
    clearFilesBtn: document.getElementById('clearFilesBtn'),
    processFilesBtn: document.getElementById('processFilesBtn'),

    // Stats
    recordCount: document.getElementById('recordCount'),
    columnCount: document.getElementById('columnCount'),
    attributeCount: document.getElementById('attributeCount'),

    // Query Section
    querySection: document.getElementById('querySection'),
    schemaSearch: document.getElementById('schemaSearch'),
    columnsList: document.getElementById('columnsList'),
    attributesList: document.getElementById('attributesList'),
    queryEditor: document.getElementById('queryEditor'),
    runQuery: document.getElementById('runQuery'),
    clearQuery: document.getElementById('clearQuery'),
    formatQuery: document.getElementById('formatQuery'),

    // Results
    resultsContainer: document.getElementById('resultsContainer'),
    resultsCount: document.getElementById('resultsCount'),
    queryTime: document.getElementById('queryTime'),
    resultsPlaceholder: document.getElementById('resultsPlaceholder'),
    resultsError: document.getElementById('resultsError'),
    errorMessage: document.getElementById('errorMessage'),
    resultsTableWrapper: document.getElementById('resultsTableWrapper'),
    resultsHead: document.getElementById('resultsHead'),
    resultsBody: document.getElementById('resultsBody'),
    resultsPagination: document.getElementById('resultsPagination'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    pageInfo: document.getElementById('pageInfo'),
    exportCsv: document.getElementById('exportCsv'),

    // Modal
    rowDetailModal: document.getElementById('rowDetailModal'),
    closeModal: document.getElementById('closeModal'),
    modalBody: document.getElementById('modalBody'),

    // Toast
    toastContainer: document.getElementById('toastContainer'),

    // Schema tabs
    schemaTabs: document.querySelectorAll('.schema-tab'),

    // New file button
    newFileBtn: document.getElementById('newFileBtn')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', init);

function init() {
    setupEventListeners();
    loadPapaParseAndAlaSQL();
}

function loadPapaParseAndAlaSQL() {
    // Load Papa Parse for CSV parsing
    const papaScript = document.createElement('script');
    papaScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
    papaScript.onload = () => {
        // Load AlaSQL for SQL queries
        const alasqlScript = document.createElement('script');
        alasqlScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/alasql/4.2.3/alasql.min.js';
        alasqlScript.onload = () => {
            console.log('Libraries loaded successfully');
            showToast('Ready to load your CSV file', 'info');
        };
        document.head.appendChild(alasqlScript);
    };
    document.head.appendChild(papaScript);
}

function setupEventListeners() {
    // File Upload
    DOM.uploadZone.addEventListener('click', () => DOM.fileInput.click());
    DOM.uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        DOM.fileInput.click();
    });
    DOM.fileInput.addEventListener('change', handleFileSelect);

    // Drag and Drop
    DOM.uploadZone.addEventListener('dragover', handleDragOver);
    DOM.uploadZone.addEventListener('dragleave', handleDragLeave);
    DOM.uploadZone.addEventListener('drop', handleDrop);

    // Query Actions
    DOM.runQuery.addEventListener('click', executeQuery);
    DOM.clearQuery.addEventListener('click', () => {
        DOM.queryEditor.value = '';
        DOM.queryEditor.focus();
    });
    DOM.formatQuery.addEventListener('click', formatQuery);

    // Keyboard shortcuts
    DOM.queryEditor.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            executeQuery();
        }
    });

    // Example queries
    document.querySelectorAll('.example-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.queryEditor.value = btn.dataset.query;
            DOM.queryEditor.focus();
        });
    });

    // Schema tabs
    DOM.schemaTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            DOM.schemaTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (tab.dataset.tab === 'columns') {
                DOM.columnsList.style.display = 'flex';
                DOM.attributesList.style.display = 'none';
            } else {
                DOM.columnsList.style.display = 'none';
                DOM.attributesList.style.display = 'flex';
            }
        });
    });

    // Schema search
    DOM.schemaSearch.addEventListener('input', filterSchema);

    // Pagination
    DOM.prevPage.addEventListener('click', () => {
        if (AppState.currentPage > 1) {
            AppState.currentPage--;
            renderResults();
        }
    });

    DOM.nextPage.addEventListener('click', () => {
        const totalPages = Math.ceil(AppState.queryResults.length / AppState.pageSize);
        if (AppState.currentPage < totalPages) {
            AppState.currentPage++;
            renderResults();
        }
    });

    // Export
    DOM.exportCsv.addEventListener('click', exportToCSV);

    // Modal
    DOM.closeModal.addEventListener('click', () => {
        DOM.rowDetailModal.style.display = 'none';
    });

    DOM.rowDetailModal.addEventListener('click', (e) => {
        if (e.target === DOM.rowDetailModal) {
            DOM.rowDetailModal.style.display = 'none';
        }
    });

    // New File button
    DOM.newFileBtn.addEventListener('click', resetAndLoadNewFile);

    // Multi-file support
    DOM.clearFilesBtn.addEventListener('click', clearAllFiles);
    DOM.processFilesBtn.addEventListener('click', processAllFiles);
}

// File Handling
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    DOM.uploadZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    DOM.uploadZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    DOM.uploadZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    addFilesToQueue(files);
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        addFilesToQueue(files);
    }
}

// Multi-file handling
function addFilesToQueue(files) {
    const csvFiles = files.filter(f => f.name.endsWith('.csv'));

    if (csvFiles.length === 0) {
        showToast('Please select CSV files only', 'error');
        return;
    }

    // Add files to pending list (avoid duplicates)
    csvFiles.forEach(file => {
        const exists = AppState.pendingFiles.some(f => f.name === file.name && f.size === file.size);
        if (!exists) {
            AppState.pendingFiles.push(file);
        }
    });

    // Show file list section
    DOM.fileListSection.style.display = 'block';

    // Validate and render file list
    validateAndRenderFileList();

    showToast(`Added ${csvFiles.length} file(s) to queue`, 'info');
}

async function validateAndRenderFileList() {
    const files = AppState.pendingFiles;

    if (files.length === 0) {
        DOM.fileListSection.style.display = 'none';
        return;
    }

    // Parse headers from each file to validate columns
    DOM.fileList.innerHTML = '<div class="loading-files">Validating files...</div>';
    DOM.fileValidation.innerHTML = '';

    const validationResults = [];
    let referenceColumns = null;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
            const headers = await getFileHeaders(file);

            if (i === 0) {
                // First file sets the reference columns
                referenceColumns = headers;
                AppState.referenceColumns = headers;
                validationResults.push({
                    file,
                    valid: true,
                    isReference: true,
                    headers,
                    message: 'Reference file'
                });
            } else {
                // Compare with reference columns
                const isValid = arraysEqual(headers, referenceColumns);
                validationResults.push({
                    file,
                    valid: isValid,
                    isReference: false,
                    headers,
                    message: isValid ? 'Columns match ✓' : 'Column mismatch!'
                });
            }
        } catch (error) {
            validationResults.push({
                file,
                valid: false,
                isReference: false,
                headers: [],
                message: 'Error reading file'
            });
        }
    }

    // Render file list
    renderFileList(validationResults);

    // Update validation summary
    updateValidationSummary(validationResults);
}

function getFileHeaders(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            // Only read first 10KB to get headers
            const text = e.target.result;
            const firstLine = text.split('\n')[0];

            Papa.parse(firstLine, {
                complete: (results) => {
                    if (results.data && results.data[0]) {
                        resolve(results.data[0]);
                    } else {
                        reject(new Error('No headers found'));
                    }
                },
                error: reject
            });
        };

        reader.onerror = reject;

        // Read only first chunk for headers
        const blob = file.slice(0, 10240);
        reader.readAsText(blob);
    });
}

function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function renderFileList(validationResults) {
    DOM.fileList.innerHTML = validationResults.map((result, index) => `
        <div class="file-item ${result.isReference ? 'first' : (result.valid ? 'valid' : 'invalid')}">
            <div class="file-item-info">
                <span class="file-item-icon">${result.valid ? '📄' : '⚠️'}</span>
                <span class="file-item-name">${escapeHtml(result.file.name)}</span>
                <span class="file-item-size">(${formatFileSize(result.file.size)})</span>
            </div>
            <div class="file-item-status ${result.isReference ? 'reference' : (result.valid ? 'valid' : 'invalid')}">
                ${result.message}
            </div>
            <button class="file-remove-btn" data-index="${index}" title="Remove file">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    `).join('');

    // Add remove button handlers
    DOM.fileList.querySelectorAll('.file-remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            removeFileFromQueue(index);
        });
    });
}

function updateValidationSummary(validationResults) {
    const validCount = validationResults.filter(r => r.valid).length;
    const totalCount = validationResults.length;
    const invalidCount = totalCount - validCount;

    if (totalCount === 1) {
        DOM.fileValidation.className = 'file-validation info';
        DOM.fileValidation.innerHTML = `📋 Ready to process 1 file`;
        DOM.processFilesBtn.disabled = false;
    } else if (invalidCount === 0) {
        DOM.fileValidation.className = 'file-validation success';
        DOM.fileValidation.innerHTML = `✅ All ${totalCount} files have matching columns and can be merged`;
        DOM.processFilesBtn.disabled = false;
    } else {
        DOM.fileValidation.className = 'file-validation error';
        DOM.fileValidation.innerHTML = `⚠️ ${invalidCount} file(s) have different columns and will be skipped. Only ${validCount} file(s) will be merged.`;
        DOM.processFilesBtn.disabled = validCount === 0;
    }
}

function removeFileFromQueue(index) {
    AppState.pendingFiles.splice(index, 1);

    if (AppState.pendingFiles.length === 0) {
        DOM.fileListSection.style.display = 'none';
        AppState.referenceColumns = null;
    } else {
        validateAndRenderFileList();
    }
}

function clearAllFiles() {
    AppState.pendingFiles = [];
    AppState.referenceColumns = null;
    DOM.fileListSection.style.display = 'none';
    DOM.fileInput.value = '';
    showToast('All files cleared', 'info');
}

async function processAllFiles() {
    if (AppState.pendingFiles.length === 0) {
        showToast('No files to process', 'error');
        return;
    }

    AppState.isLoading = true;
    DOM.uploadProgress.style.display = 'block';
    DOM.fileListSection.style.display = 'none';
    DOM.progressFill.style.width = '0%';
    DOM.progressText.textContent = 'Reading files...';

    const allData = [];
    const validFiles = [];

    // Process each file
    for (let i = 0; i < AppState.pendingFiles.length; i++) {
        const file = AppState.pendingFiles[i];
        const progress = Math.round((i / AppState.pendingFiles.length) * 60);
        DOM.progressFill.style.width = progress + '%';
        DOM.progressText.textContent = `Processing file ${i + 1} of ${AppState.pendingFiles.length}: ${file.name}`;

        try {
            const fileData = await parseFileAsync(file);

            // Check if columns match reference
            if (i === 0) {
                AppState.columns = fileData.columns;
                allData.push(...fileData.data);
                validFiles.push(file.name);
            } else if (arraysEqual(fileData.columns, AppState.columns)) {
                allData.push(...fileData.data);
                validFiles.push(file.name);
            }
        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
        }
    }

    if (allData.length === 0) {
        showToast('No valid data found in files', 'error');
        AppState.isLoading = false;
        DOM.uploadProgress.style.display = 'none';
        return;
    }

    AppState.rawData = allData;

    DOM.progressText.textContent = 'Extracting attributes...';
    DOM.progressFill.style.width = '75%';

    // Process merged data
    setTimeout(() => {
        processData();
        showToast(`Merged ${validFiles.length} file(s) with ${allData.length.toLocaleString()} total records`, 'success');
    }, 100);
}

function parseFileAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            Papa.parse(e.target.result, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    resolve({
                        columns: results.meta.fields || [],
                        data: results.data
                    });
                },
                error: reject
            });
        };

        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function parseCSV(csvData) {
    DOM.progressText.textContent = 'Processing data...';
    DOM.progressFill.style.width = '70%';

    Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            if (results.errors.length > 0) {
                console.warn('CSV parsing warnings:', results.errors);
            }

            AppState.rawData = results.data;
            AppState.columns = results.meta.fields || [];

            DOM.progressText.textContent = 'Extracting attributes...';
            DOM.progressFill.style.width = '85%';

            setTimeout(() => {
                processData();
            }, 100);
        },
        error: (error) => {
            showToast('Error parsing CSV: ' + error.message, 'error');
            AppState.isLoading = false;
            DOM.uploadProgress.style.display = 'none';
        }
    });
}

function processData() {
    // Extract all unique attributes from Participant Attributes Formatted column
    AppState.attributes.clear();

    const attrColumn = AppState.columns.find(c =>
        c.toLowerCase().includes('participant attributes formatted') ||
        c.toLowerCase() === 'participant attributes formatted'
    );

    const rawAttrColumn = AppState.columns.find(c =>
        c.toLowerCase() === 'participant attributes' ||
        (c.toLowerCase().includes('participant attributes') && !c.toLowerCase().includes('formatted'))
    );

    // Process each row
    AppState.parsedData = AppState.rawData.map((row, index) => {
        const processedRow = { ...row, _rowIndex: index };
        processedRow._attributes = {};

        // Parse formatted attributes (cleaner)
        const attrString = attrColumn ? row[attrColumn] : (rawAttrColumn ? row[rawAttrColumn] : '');

        if (attrString) {
            // Parse the formatted attributes (key:value; key:value format)
            const pairs = attrString.split(';').map(s => s.trim()).filter(s => s);

            pairs.forEach(pair => {
                // Handle the format with or without GUID prefix
                let key, value;

                // Check if it has GUID prefix (uuid-key:value)
                const guidMatch = pair.match(/^[a-f0-9-]+-(.+):(.*)$/i);
                if (guidMatch) {
                    key = guidMatch[1].trim();
                    value = guidMatch[2].trim();
                } else {
                    // Simple key:value format
                    const colonIndex = pair.indexOf(':');
                    if (colonIndex > 0) {
                        key = pair.substring(0, colonIndex).trim();
                        value = pair.substring(colonIndex + 1).trim();
                    }
                }

                if (key) {
                    AppState.attributes.add(key);
                    processedRow._attributes[key] = value || '';
                }
            });
        }

        return processedRow;
    });

    DOM.progressFill.style.width = '100%';
    DOM.progressText.textContent = 'Complete!';

    setTimeout(() => {
        finishLoading();
    }, 300);
}

function finishLoading() {
    // Update stats
    DOM.recordCount.textContent = AppState.parsedData.length.toLocaleString();
    DOM.columnCount.textContent = AppState.columns.length.toLocaleString();
    DOM.attributeCount.textContent = AppState.attributes.size.toLocaleString();

    // Populate schema explorer
    populateSchemaExplorer();

    // Register custom ATTR function for AlaSQL
    registerCustomFunctions();

    // Switch views
    DOM.uploadSection.style.display = 'none';
    DOM.querySection.style.display = 'grid';

    // Show the New File button
    DOM.newFileBtn.style.display = 'inline-flex';

    // Set default query
    DOM.queryEditor.value = 'SELECT * FROM interactions LIMIT 200';

    AppState.isLoading = false;
    showToast(`Loaded ${AppState.parsedData.length.toLocaleString()} records with ${AppState.attributes.size} unique attributes`, 'success');
}

function resetAndLoadNewFile() {
    // Reset app state
    AppState.rawData = [];
    AppState.parsedData = [];
    AppState.columns = [];
    AppState.attributes.clear();
    AppState.queryResults = [];
    AppState.currentPage = 1;
    AppState.isLoading = false;

    // Reset multi-file state
    AppState.pendingFiles = [];
    AppState.fileResults = [];
    AppState.referenceColumns = null;

    // Reset UI stats
    DOM.recordCount.textContent = '0';
    DOM.columnCount.textContent = '0';
    DOM.attributeCount.textContent = '0';

    // Reset file input
    DOM.fileInput.value = '';

    // Reset query editor
    DOM.queryEditor.value = '';

    // Reset results
    DOM.resultsPlaceholder.style.display = 'flex';
    DOM.resultsPlaceholder.innerHTML = `
        <div class="placeholder-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
        </div>
        <p>Write a query and press <strong>Run Query</strong> to see results</p>
    `;
    DOM.resultsError.style.display = 'none';
    DOM.resultsTableWrapper.style.display = 'none';
    DOM.resultsPagination.style.display = 'none';
    DOM.resultsCount.textContent = '';
    DOM.queryTime.textContent = '';

    // Clear schema lists
    DOM.columnsList.innerHTML = '';
    DOM.attributesList.innerHTML = '';

    // Hide query section, show upload section
    DOM.querySection.style.display = 'none';
    DOM.uploadSection.style.display = 'flex';

    // Hide the New File button
    DOM.newFileBtn.style.display = 'none';

    // Hide file list section
    DOM.fileListSection.style.display = 'none';

    // Reset upload progress
    DOM.uploadProgress.style.display = 'none';
    DOM.progressFill.style.width = '0%';

    showToast('Ready to load new files', 'info');
}

function populateSchemaExplorer() {
    // Columns list
    DOM.columnsList.innerHTML = '';
    AppState.columns.forEach(col => {
        const item = document.createElement('div');
        item.className = 'schema-item column';
        item.innerHTML = `
            <span class="type-badge">COL</span>
            <span title="${col}">${col}</span>
        `;
        item.addEventListener('click', () => {
            insertIntoQuery(`[${col}]`);
        });
        DOM.columnsList.appendChild(item);
    });

    // Attributes list
    DOM.attributesList.innerHTML = '';
    const sortedAttrs = Array.from(AppState.attributes).sort();
    sortedAttrs.forEach(attr => {
        const item = document.createElement('div');
        item.className = 'schema-item attribute';
        item.innerHTML = `
            <span class="type-badge">ATTR</span>
            <span title="${attr}">${attr}</span>
        `;
        item.addEventListener('click', () => {
            insertIntoQuery(`ATTR('${attr}')`);
        });
        DOM.attributesList.appendChild(item);
    });
}

function filterSchema() {
    const search = DOM.schemaSearch.value.toLowerCase();

    document.querySelectorAll('.schema-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(search) ? 'flex' : 'none';
    });
}

function insertIntoQuery(text) {
    const textarea = DOM.queryEditor;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    textarea.value = value.substring(0, start) + text + value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
}

function registerCustomFunctions() {
    // Register the custom ATTR function
    alasql.fn.ATTR = function (key) {
        // This will be called with the context set to the current row
        return this._attributes ? (this._attributes[key] || '') : '';
    };

    // Create the 'interactions' table
    alasql('DROP TABLE IF EXISTS interactions');

    // Create table with all columns
    const columnDefs = AppState.columns.map(col => `[${col}] STRING`).join(', ');
    alasql(`CREATE TABLE interactions (${columnDefs}, _rowIndex INT, _attributes OBJECT)`);

    // Insert data
    alasql.tables.interactions.data = AppState.parsedData;
}

function executeQuery() {
    const query = DOM.queryEditor.value.trim();

    if (!query) {
        showToast('Please enter a query', 'error');
        return;
    }

    const startTime = performance.now();

    try {
        // Preprocess query to handle ATTR function calls
        let processedQuery = preprocessQuery(query);

        // Execute query
        const results = alasql(processedQuery);
        const endTime = performance.now();

        AppState.queryResults = results;
        AppState.currentPage = 1;

        DOM.resultsCount.textContent = `${results.length.toLocaleString()} rows`;
        DOM.queryTime.textContent = `(${(endTime - startTime).toFixed(2)}ms)`;

        if (results.length === 0) {
            showNoResults();
        } else {
            renderResults();
        }

    } catch (error) {
        showError(error.message);
    }
}

function preprocessQuery(query) {
    // Replace ATTR('key') in SELECT with a function that extracts from _attributes
    // This creates a computed column for display

    let processedQuery = query;

    // Handle ATTR in SELECT - create virtual columns
    const selectAttrRegex = /ATTR\s*\(\s*'([^']+)'\s*\)/gi;

    // For WHERE clauses with ATTR
    processedQuery = processedQuery.replace(/WHERE\s+ATTR\s*\(\s*'([^']+)'\s*\)\s*(!?=|LIKE|<>|>|<|>=|<=)\s*'([^']*)'/gi,
        (match, key, op, value) => {
            // Convert to a lookup in _attributes
            return `WHERE ATTR(_rowIndex, '${key}') ${op} '${value}'`;
        });

    // Register row-based ATTR lookup
    alasql.fn.ATTR = function (rowIndexOrKey, maybeKey) {
        if (typeof rowIndexOrKey === 'number') {
            // Called from WHERE clause: ATTR(rowIndex, key)
            const row = AppState.parsedData[rowIndexOrKey];
            return row && row._attributes ? (row._attributes[maybeKey] || '') : '';
        } else {
            // Called with just key (in context)
            return this._attributes ? (this._attributes[rowIndexOrKey] || '') : '';
        }
    };

    // Handle ATTR in WHERE with row context
    processedQuery = processedQuery.replace(
        /ATTR\s*\(\s*'([^']+)'\s*\)/gi,
        (match, key) => `ATTR(_rowIndex, '${key}')`
    );

    return processedQuery;
}

function showNoResults() {
    DOM.resultsPlaceholder.style.display = 'flex';
    DOM.resultsError.style.display = 'none';
    DOM.resultsTableWrapper.style.display = 'none';
    DOM.resultsPagination.style.display = 'none';

    DOM.resultsPlaceholder.innerHTML = `
        <div class="placeholder-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
        </div>
        <p>No records match your query</p>
    `;
}

function showError(message) {
    DOM.resultsPlaceholder.style.display = 'none';
    DOM.resultsError.style.display = 'block';
    DOM.resultsTableWrapper.style.display = 'none';
    DOM.resultsPagination.style.display = 'none';

    DOM.errorMessage.textContent = message;
}

function renderResults() {
    DOM.resultsPlaceholder.style.display = 'none';
    DOM.resultsError.style.display = 'none';
    DOM.resultsTableWrapper.style.display = 'block';

    const results = AppState.queryResults;
    const start = (AppState.currentPage - 1) * AppState.pageSize;
    const end = Math.min(start + AppState.pageSize, results.length);
    const pageData = results.slice(start, end);

    if (pageData.length === 0) {
        showNoResults();
        return;
    }

    // Get columns to display (exclude internal columns)
    const displayColumns = Object.keys(pageData[0]).filter(col =>
        !col.startsWith('_')
    );

    // Render header
    DOM.resultsHead.innerHTML = `
        <tr>
            ${displayColumns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}
        </tr>
    `;

    // Render body
    DOM.resultsBody.innerHTML = pageData.map((row, idx) => `
        <tr data-index="${start + idx}">
            ${displayColumns.map(col => {
        let value = row[col];
        if (value === null || value === undefined) value = '';
        if (typeof value === 'object') value = JSON.stringify(value);
        const displayValue = String(value).length > 100
            ? String(value).substring(0, 100) + '...'
            : String(value);
        return `<td title="${escapeHtml(String(value))}">${escapeHtml(displayValue)}</td>`;
    }).join('')}
        </tr>
    `).join('');

    // Add row click handlers
    DOM.resultsBody.querySelectorAll('tr').forEach(tr => {
        tr.addEventListener('click', () => {
            const index = parseInt(tr.dataset.index);
            showRowDetail(AppState.queryResults[index]);
        });
    });

    // Update pagination
    const totalPages = Math.ceil(results.length / AppState.pageSize);
    DOM.resultsPagination.style.display = totalPages > 1 ? 'flex' : 'none';
    DOM.pageInfo.textContent = `Page ${AppState.currentPage} of ${totalPages}`;
    DOM.prevPage.disabled = AppState.currentPage === 1;
    DOM.nextPage.disabled = AppState.currentPage === totalPages;
}

function showRowDetail(row) {
    // Separate structured columns from attributes
    const structuredData = {};
    const attributes = row._attributes || {};

    Object.keys(row).forEach(key => {
        if (!key.startsWith('_') &&
            !key.toLowerCase().includes('participant attributes')) {
            structuredData[key] = row[key];
        }
    });

    // Build modal content
    let html = `
        <div class="detail-section">
            <h4>Structured Data</h4>
            <div class="detail-grid">
                ${Object.entries(structuredData).map(([key, value]) => `
                    <div class="detail-item">
                        <div class="detail-label">${escapeHtml(key)}</div>
                        <div class="detail-value">${escapeHtml(String(value || '-'))}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    if (Object.keys(attributes).length > 0) {
        html += `
            <div class="detail-section">
                <h4>Participant Attributes (${Object.keys(attributes).length})</h4>
                <div class="detail-grid">
                    ${Object.entries(attributes).sort((a, b) => a[0].localeCompare(b[0])).map(([key, value]) => `
                        <div class="detail-item">
                            <div class="detail-label">${escapeHtml(key)}</div>
                            <div class="detail-value">${escapeHtml(String(value || '-'))}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    DOM.modalBody.innerHTML = html;
    DOM.rowDetailModal.style.display = 'flex';
}

function formatQuery() {
    let query = DOM.queryEditor.value.trim();

    // Simple SQL formatting
    const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'ON'];

    keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        query = query.replace(regex, '\n' + keyword.toUpperCase());
    });

    // Clean up leading newline
    query = query.replace(/^\n+/, '');

    // Fix comma spacing
    query = query.replace(/,\s*/g, ', ');

    DOM.queryEditor.value = query;
}

function exportToCSV() {
    if (AppState.queryResults.length === 0) {
        showToast('No results to export', 'error');
        return;
    }

    // Get columns to export (exclude internal columns)
    const exportData = AppState.queryResults.map(row => {
        const cleanRow = {};
        Object.keys(row).forEach(key => {
            if (!key.startsWith('_')) {
                cleanRow[key] = row[key];
            }
        });
        return cleanRow;
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `query_results_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${AppState.queryResults.length} rows to CSV`, 'success');
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;

    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
