// Configuración de la aplicación
const CONFIG = {
    API_BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : 'https://intelichat-backend.railway.app', // Backend URL
    EDITOR_OPTIONS: {
        autofocus: true,
        spellChecker: false,
        placeholder: 'Escribe aquí el system prompt del agente...',
        status: false,
        toolbar: [
            'bold', 'italic', 'heading', '|',
            'quote', 'unordered-list', 'ordered-list', '|',
            'link', 'image', '|',
            'preview', 'side-by-side', 'fullscreen', '|',
            'guide'
        ],
        lineWrapping: true,
        tabSize: 2
    }
};

// Estado global de la aplicación
const AppState = {
    editor: null,
    currentAgent: null,
    originalAgentState: {},
    clients: [],
    chatbots: [],
    agents: [],
    apis: [],
    forms: [],
    handoffs: [],
    ragCartridges: [],
    recognition: null,
    isListening: false,
    autocompleteSuggestions: [],
    currentAutocompleteCursor: null,
    selectedSuggestionIndex: -1,
    currentLanguage: 'es' // Estado del idioma actual
};

// Elementos del DOM (nueva estructura)
const Elements = {
    // Toolbar
    clienteSelect: null,
    chatbotSelect: null,
    agenteSelect: null,
    savePrompt: null,
    assistantBtn: null,
    validationBtn: null,
    helpBtn: null,
    themeToggle: null,
    themeTrack: null,
    langToggle: null,
    langTrack: null,

    // Main Content Area
    tabPrompt: null,
    tabParams: null,
    tabMessages: null,
    promptContent: null,
    paramsContent: null,
    messagesContent: null,
    promptEditor: null,
    resetPrompt: null,
    saveStatus: null,
    autocompleteSuggestions: null,

    // Inspector Panel
    agentInfo: null,
    recursosContent: null,
    ragContent: null,
    handoffsContent: null,

    // Modals
    helpModalOverlay: null,
    helpModalClose: null,
    assistantModalOverlay: null,
    assistantModalClose: null,
    validationModalOverlay: null,
    validationModalClose: null,
    runValidationBtn: null,
    validationReportContainer: null,
    validationStatus: null,
    // Assistant Modal
    generateSuggestionBtn: null,
    userSuggestion: null,
    suggestionNotes: null,
    suggestionExample: null,
    applySuggestionBtn: null,
    micBtn: null,
    
    // Form Fields (se mantienen igual)
    temperatura: null,
    top_p: null,
    max_tokens: null,
    mensaje_bienvenida_es: null,
    mensaje_bienvenida_en: null,
    mensaje_retorno_es: null,
    mensaje_retorno_en: null,
    mensaje_despedida_es: null,
    mensaje_despedida_en: null,
    mensaje_handoff_confirmacion_es: null,
    mensaje_handoff_confirmacion_en: null,
    mensaje_final_tarea_es: null,
    mensaje_final_tarea_en: null
};

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        initializeElements();
        initializeEditor();
        setupEventListeners();
        theme.init();
        language.init();
        await loadInitialData();
        console.log('✅ Editor de Agentes v3.0 inicializado correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error);
    }
});

function initializeElements() {
    const ids = [
        'clienteSelect', 'chatbotSelect', 'agenteSelect', 'savePrompt', 'assistantBtn',
        'validationBtn', 'helpBtn', 'themeToggle', 'themeTrack', 'langToggle', 'langTrack', 'tabPrompt', 'tabParams',
        'tabMessages', 'promptContent', 'paramsContent', 'messagesContent', 'promptEditor',
        'resetPrompt', 'saveStatus', 'autocompleteSuggestions', 'agentInfo', 'recursosContent',
        'ragContent', 'handoffsContent', 'helpModalOverlay', 'helpModalClose', 'assistantModalOverlay',
        'assistantModalClose', 'validationModalOverlay', 'validationModalClose',
        'runValidationBtn', 'validationReportContainer', 'validationStatus',
        'generateSuggestionBtn', 'userSuggestion', 'suggestionNotes', 'suggestionExample', 'applySuggestionBtn', 'micBtn',
        'temperatura', 'top_p', 'max_tokens', 'mensaje_bienvenida_es', 'mensaje_bienvenida_en',
        'mensaje_retorno_es', 'mensaje_retorno_en', 'mensaje_despedida_es', 'mensaje_despedida_en',
        'mensaje_handoff_confirmacion_es', 'mensaje_handoff_confirmacion_en',
        'mensaje_final_tarea_es', 'mensaje_final_tarea_en'
    ];
    ids.forEach(id => {
        if (document.getElementById(id)) {
            Elements[id] = document.getElementById(id);
        }
    });
}

function initializeEditor() {
    if (!Elements.promptEditor) return;
    AppState.editor = new EasyMDE({
        element: Elements.promptEditor,
        ...CONFIG.EDITOR_OPTIONS
    });
    AppState.editor.codemirror.on('change', checkForChanges);
    setupAutocomplete();
}

function setupAutocomplete() {
    const cm = AppState.editor.codemirror;
    cm.on('cursorActivity', () => handleAutocomplete());

    cm.on('keydown', (cm, event) => {
        const suggestionsVisible = Elements.autocompleteSuggestions.style.display !== 'none';
        if (!suggestionsVisible) return;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                selectSuggestion(AppState.selectedSuggestionIndex + 1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                selectSuggestion(AppState.selectedSuggestionIndex - 1);
                break;
            case 'Enter':
            case 'Tab':
                event.preventDefault();
                applySuggestion(AppState.selectedSuggestionIndex);
                break;
            case 'Escape':
                event.preventDefault();
                hideAutocomplete();
                break;
        }
    });
}

function handleAutocomplete() {
    const cm = AppState.editor.codemirror;
    if (cm.state.completionActive) return;

    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const textBefore = line.substring(0, cursor.ch);

    let suggestions = [];
    // Use a regex to be more flexible with whitespace
    if (/tool$/.test(textBefore)) {
        suggestions = getToolSnippets();
    } else if (/rag$/.test(textBefore)) {
        suggestions = getRAGSnippets();
    } else if (/call_tool\($/.test(textBefore)) {
        suggestions = getApiSuggestions();
    } else if (/rag_query\($/.test(textBefore)) {
        suggestions = getRAGCartridgeSuggestions();
    } else if (/\${$/.test(textBefore)) {
        suggestions = getContextVarSuggestions();
    }

    if (suggestions.length > 0) {
        AppState.autocompleteSuggestions = suggestions;
        showAutocomplete();
    } else {
        hideAutocomplete();
    }
}

function getToolSnippets() {
    return [{
        text: 'call_tool("", {})',
        displayText: 'call_tool("nombre_herramienta", { ... })',
        type: 'Snippet'
    }];
}

function getRAGSnippets() {
    return [{
        text: 'rag_query("", "")',
        displayText: 'rag_query("cartucho", "consulta")',
        type: 'RAG Snippet'
    }, {
        text: '{\n    "say": "Déjame buscar esa información...",\n    "action": {\n        "type": "rag_query",\n        "cartridge": "",\n        "query": ""\n    }\n}',
        displayText: 'RAG Query JSON completo',
        type: 'RAG Template'
    }];
}

function getApiSuggestions() {
    const apis = AppState.apis.map(api => ({
        text: `"${api.nombre}"`,
        displayText: `⚙️ ${api.nombre}`,
        type: 'Herramienta'
    }));
    const forms = AppState.forms.map(form => ({
        text: `"${form.nombre}"`,
        displayText: `📋 ${form.nombre}`,
        type: 'Formulario'
    }));
    return [...apis, ...forms];
}

function getRAGCartridgeSuggestions() {
    if (!AppState.ragCartridges || AppState.ragCartridges.length === 0) {
        return [{
            text: '"nombre_cartucho"',
            displayText: '🔍 (No hay cartuchos RAG disponibles)',
            type: 'RAG Info'
        }];
    }
    
    return AppState.ragCartridges
        .filter(cartucho => cartucho.activo)
        .map(cartucho => ({
            text: `"${cartucho.nombre}"`,
            displayText: `🔍 ${cartucho.nombre} (${cartucho.proveedor})`,
            type: 'RAG Cartucho'
        }));
}

function getContextVarSuggestions() {
    // TODO: Cargar estas variables dinámicamente en el futuro
    const contextVars = ['nombre_usuario', 'email_usuario', 'chat_id', 'cliente_id', 'turno_actual'];
    return contextVars.map(v => ({
        text: `${v}}`,
        displayText: `\${${v}}`,
        type: 'Variable'
    }));
}

function showAutocomplete() {
    const cm = AppState.editor.codemirror;
    const cursor = cm.getCursor();
    const coords = cm.cursorCoords(cursor, 'local');
    
    const suggestionsEl = Elements.autocompleteSuggestions;
    suggestionsEl.style.display = 'block';
    suggestionsEl.style.left = `${coords.left}px`;
    suggestionsEl.style.top = `${coords.bottom}px`;

    suggestionsEl.innerHTML = AppState.autocompleteSuggestions.map((s, index) =>
        `<div class="suggestion-item" data-index="${index}">
            <span class="suggestion-type">${s.type}</span>
            <span class="suggestion-text">${s.displayText}</span>
        </div>`
    ).join('');

    selectSuggestion(0);

    suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('mousedown', (event) => {
            event.preventDefault();
            applySuggestion(parseInt(item.dataset.index, 10));
        });
    });
}

function hideAutocomplete() {
    Elements.autocompleteSuggestions.style.display = 'none';
    AppState.selectedSuggestionIndex = -1;
}

function selectSuggestion(index) {
    const items = Elements.autocompleteSuggestions.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;
    if (index < 0) index = items.length - 1;
    if (index >= items.length) index = 0;

    items.forEach((item, i) => {
        item.classList.toggle('selected', i === index);
    });

    AppState.selectedSuggestionIndex = index;
}

function applySuggestion(index) {
    if (index < 0 || index >= AppState.autocompleteSuggestions.length) return;

    const suggestion = AppState.autocompleteSuggestions[index];
    const cm = AppState.editor.codemirror;
    const cursor = cm.getCursor();
    
    const line = cm.getLine(cursor.line);
    const textBefore = line.substring(0, cursor.ch);

    let from = { line: cursor.line, ch: 0 };
    let to = { line: cursor.line, ch: cursor.ch };

    if (suggestion.type === 'Snippet') {
        from.ch = textBefore.lastIndexOf('tool');
    } else if (suggestion.type === 'RAG Snippet' || suggestion.type === 'RAG Template') {
        from.ch = textBefore.lastIndexOf('rag');
    } else if (suggestion.type === 'Variable') {
        from.ch = textBefore.lastIndexOf('${');
    } else if (suggestion.type === 'Herramienta' || suggestion.type === 'Formulario') {
        from.ch = textBefore.lastIndexOf('call_tool(') + 'call_tool('.length;
    } else if (suggestion.type === 'RAG Cartucho' || suggestion.type === 'RAG Info') {
        from.ch = textBefore.lastIndexOf('rag_query(') + 'rag_query('.length;
    }
    
    cm.replaceRange(suggestion.text, from, to);
    
    hideAutocomplete();
    cm.focus();
}


function setupEventListeners() {
    // Toolbar
    Elements.clienteSelect.addEventListener('change', handleClienteChange);
    Elements.chatbotSelect.addEventListener('change', handleChatbotChange);
    Elements.agenteSelect.addEventListener('change', handleAgenteChange);
    Elements.savePrompt.addEventListener('click', handleSavePrompt);

    // Main Tabs
    Elements.tabPrompt.addEventListener('click', () => switchMainTab('prompt'));
    Elements.tabParams.addEventListener('click', () => switchMainTab('params'));
    Elements.tabMessages.addEventListener('click', () => switchMainTab('messages'));

    // Editor Actions
    Elements.resetPrompt.addEventListener('click', handleReset);

    // Modal Buttons
    Elements.helpBtn.addEventListener('click', () => openModal('help'));
    Elements.assistantBtn.addEventListener('click', () => openModal('assistant'));
    Elements.validationBtn.addEventListener('click', () => openModal('validation'));
    Elements.runValidationBtn.addEventListener('click', handleRunValidation);

    // Assistant Modal Buttons
    Elements.generateSuggestionBtn.addEventListener('click', handleGenerateSuggestion);
    Elements.applySuggestionBtn.addEventListener('click', handleApplySuggestion);
    
    // Assistant Modal Buttons
    Elements.generateSuggestionBtn.addEventListener('click', handleGenerateSuggestion);
    Elements.applySuggestionBtn.addEventListener('click', handleApplySuggestion);
    
    // Modal Close Buttons
    Elements.helpModalClose.addEventListener('click', () => closeModal('help'));
    Elements.assistantModalClose.addEventListener('click', () => closeModal('assistant'));
    Elements.validationModalClose.addEventListener('click', () => closeModal('validation'));
    
    
    // Theme
    Elements.themeToggle.addEventListener('change', (e) => theme.setDark(e.target.checked));
    Elements.themeTrack.addEventListener('click', () => Elements.themeToggle.click());
    
    // Language
    Elements.langToggle.addEventListener('change', (e) => language.setLanguage(e.target.checked ? 'en' : 'es'));
    Elements.langTrack.addEventListener('click', () => Elements.langToggle.click());

    // Form inputs change detection
    const formInputs = document.querySelectorAll('.form-input, .form-textarea');
    formInputs.forEach(input => {
        input.addEventListener('input', checkForChanges);
    });
}

// --- LÓGICA DE PESTAÑAS Y MODALES ---

function switchMainTab(tabName) {
    const tabButtons = { 
        prompt: Elements.tabPrompt, 
        params: Elements.tabParams, 
        messages: Elements.tabMessages 
    };
    const tabPanes = {
        prompt: Elements.promptContent,
        params: Elements.paramsContent,
        messages: Elements.messagesContent
    };

    for (const key in tabButtons) {
        if (tabButtons[key]) tabButtons[key].classList.remove('active');
        if (tabPanes[key]) tabPanes[key].classList.remove('active');
    }

    const buttonToActivate = tabButtons[tabName];
    const paneToActivate = tabPanes[tabName];

    if (buttonToActivate && paneToActivate) {
        buttonToActivate.classList.add('active');
        paneToActivate.classList.add('active');
    }
}

function openModal(modalName) {
    const overlay = Elements[`${modalName}ModalOverlay`];
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

function closeModal(modalName) {
    const overlay = Elements[`${modalName}ModalOverlay`];
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// --- CARGA Y MANEJO DE DATOS ---

async function loadInitialData() {
    try {
        showStatus('Cargando clientes...', 'saving');
        const clientsResponse = await fetchAPI('/api/agents/clients');
        AppState.clients = Array.isArray(clientsResponse.data) ? clientsResponse.data : [];
        populateSelect(Elements.clienteSelect, AppState.clients, 'Seleccionar Cliente...', 'cliente_id', 'nombre');
        showStatus('Clientes cargados', 'success');
    } catch (error) {
        console.error('Error cargando clientes:', error);
        showStatus('Error al cargar clientes', 'error');
    }
}

async function handleClienteChange() {
    const clienteId = Elements.clienteSelect.value;
    clearSelect(Elements.chatbotSelect, 'Seleccionar Chatbot...');
    clearSelect(Elements.agenteSelect, 'Seleccionar Agente...');
    clearAllData();
    if (!clienteId) return;
    try {
        showStatus('Cargando chatbots...', 'saving');
        const chatbotsResponse = await fetchAPI(`/api/agents/chatbots?cliente_id=${clienteId}`);
        AppState.chatbots = Array.isArray(chatbotsResponse.data) ? chatbotsResponse.data : [];
        populateSelect(Elements.chatbotSelect, AppState.chatbots, 'Seleccionar Chatbot...', 'chatbot_id', 'nombre');
        clearStatus();
    } catch (error) {
        console.error('Error cargando chatbots:', error);
        showStatus('Error al cargar chatbots', 'error');
    }
}

async function handleChatbotChange() {
    const chatbotId = Elements.chatbotSelect.value;
    const clienteId = Elements.clienteSelect.value;
    clearSelect(Elements.agenteSelect, 'Seleccionar Agente...');
    clearAllData();
    if (!chatbotId || !clienteId) return;
    try {
        showStatus('Cargando agentes...', 'saving');
        const agentsResponse = await fetchAPI(`/api/agents/by-client-chatbot?cliente_id=${clienteId}&chatbot_id=${chatbotId}`);
        AppState.agents = Array.isArray(agentsResponse.data) ? agentsResponse.data : [];
        populateSelect(Elements.agenteSelect, AppState.agents, 'Seleccionar Agente...', 'agente_id', 'rol');
        clearStatus();
    } catch (error) {
        console.error('Error cargando agentes:', error);
        showStatus('Error cargando agentes', 'error');
    }
}

async function handleAgenteChange() {
    const agenteId = Elements.agenteSelect.value;
    if (!agenteId) {
        clearAllData();
        return;
    }
    try {
        showStatus('Cargando datos del agente...', 'saving');
        const response = await fetchAPI(`/api/agents/${agenteId}?lang=${AppState.currentLanguage}`);
        // Manejar estructura de datos del backend: response.data.0 o response.data[0]
        let agentData = null;
        if (response.data) {
            if (response.data[0]) {
                agentData = response.data[0];
            } else if (response.data['0']) {
                agentData = response.data['0'];
            } else {
                agentData = response.data;
            }
        }

        if (!agentData) throw new Error('Respuesta de API inválida');

        AppState.currentAgent = agentData;
        AppState.originalAgentState = JSON.parse(JSON.stringify(agentData)); // Deep copy

        // Cargar datos en la UI - usar el prompt en el idioma seleccionado
        const promptField = AppState.currentLanguage === 'en' ? 'system_prompt_en' : 'system_prompt_es';
        AppState.editor.value(agentData[promptField] || '');
        await loadAgentResources(agenteId);
        updateUIWithAgentData();
        
        Elements.resetPrompt.disabled = false;
        checkForChanges();
        clearStatus();
    } catch (error) {
        console.error('Error cargando agente:', error);
        showStatus('Error al cargar datos del agente', 'error');
    }
}

async function loadAgentResources(agenteId) {
    try {
        const [toolsResponse, handoffsResponse, ragResponse] = await Promise.all([
            fetchAPI(`/api/agents/${agenteId}/tools-editor`),
            fetchAPI(`/api/agents/${agenteId}/handoffs`),
            fetchAPI(`/api/agents/${agenteId}/rag-cartridges`)
        ]);
        AppState.apis = toolsResponse.data?.apis || [];
        AppState.forms = toolsResponse.data?.forms || [];
        AppState.handoffs = handoffsResponse.data || [];
        AppState.ragCartridges = ragResponse.data || [];
    } catch (error) {
        console.error('Error cargando recursos del agente:', error);
        AppState.apis = [];
        AppState.forms = [];
        AppState.handoffs = [];
        AppState.ragCartridges = [];
    }
}

// --- ACTUALIZACIÓN DE UI ---

function updateUIWithAgentData() {
    if (!AppState.currentAgent) return;
    updateInspectorPanel();
    updateForms();
}

function updateInspectorPanel() {
    const agent = AppState.currentAgent;
    // Info
    Elements.agentInfo.innerHTML = `
        <h3>ℹ️ Info del Agente</h3>
        <div class="info-row"><span class="info-label">ID:</span><span class="info-value">${agent.agente_id || agent.id}</span></div>
        <div class="info-row"><span class="info-label">Nombre:</span><span class="info-value">${agent.nombre || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Rol:</span><span class="info-value">${agent.rol || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Estado:</span><span class="info-value">${agent.is_active ? 'Activo' : 'Inactivo'}</span></div>
        <div class="info-row"><span class="info-label">Modelo LLM:</span><span class="info-value">${agent.llm_model_name || 'N/A'}</span></div>
    `;
    // Recursos
    let recursosHtml = '<h3>🛠️ Recursos</h3>';
    if (AppState.apis.length > 0) {
        recursosHtml += '<h4>Herramientas (APIs)</h4>';
        AppState.apis.forEach(api => {
            recursosHtml += `<div class="resource-item"><h4>⚙️ ${api.nombre}</h4><p>${api.descripcion || 'Sin descripción'}</p></div>`;
        });
    }
    if (AppState.forms.length > 0) {
        recursosHtml += '<h4>Formularios</h4>';
        AppState.forms.forEach(form => {
            const formName = form.nombre || form.name || 'Sin nombre';
            const formDescription = form.descripcion || form.description || 'Sin descripción';
            recursosHtml += `<div class="resource-item"><h4>📋 ${formName}</h4><p>${formDescription}</p></div>`;
        });
    }
    if (AppState.apis.length === 0 && AppState.forms.length === 0) {
        recursosHtml += '<p class="empty-state">No hay recursos.</p>';
    }
    Elements.recursosContent.innerHTML = recursosHtml;

    // Handoffs
    let handoffsHtml = '<h3>🤝 Handoffs</h3>';
    if (AppState.handoffs.length > 0) {
        AppState.handoffs.forEach(handoff => {
            handoffsHtml += `<div class="resource-item"><h4>🤝 ${handoff.trigger_codigo}</h4><p>To Agent ID: ${handoff.to_agente_id}</p></div>`;
        });
    } else {
        handoffsHtml += '<p class="empty-state">No hay handoffs.</p>';
    }
    Elements.handoffsContent.innerHTML = handoffsHtml;
    
    // RAG Cartridges
    updateRAGContent();
}

function updateRAGContent() {
    if (!AppState.ragCartridges || AppState.ragCartridges.length === 0) {
        Elements.ragContent.innerHTML = '<p class="empty-state">No hay cartuchos RAG asociados.</p>';
        return;
    }

    let ragHtml = '';
    AppState.ragCartridges.forEach(cartucho => {
        // Verificar múltiples campos para el estado activo
        const isActive = cartucho.activo || cartucho.habilitado || cartucho.active || cartucho.enabled;
        const statusClass = isActive ? 'status-active' : 'status-inactive';
        const statusText = isActive ? 'Activo' : 'Inactivo';
        
        ragHtml += `
            <div class="resource-item">
                <div class="resource-header">
                    <span class="resource-name">${cartucho.nombre}</span>
                    <span class="resource-status ${statusClass}">${statusText}</span>
                </div>
                <div class="resource-details">
                    <p><strong>Proveedor:</strong> ${cartucho.proveedor}</p>
                    <p><strong>Índice:</strong> ${cartucho.indice_nombre}</p>
                    ${cartucho.dominio_tag ? `<p><strong>Dominio:</strong> ${cartucho.dominio_tag}</p>` : ''}
                </div>
                ${isActive ? `
                <div class="resource-actions">
                    <button class="btn-insert-rag" onclick="insertRAGSnippet('${cartucho.nombre}')" title="Insertar snippet RAG">
                        📝 Insertar RAG Query
                    </button>
                    <button class="btn-insert-template" onclick="insertRAGTemplate('${cartucho.nombre}')" title="Insertar template completo">
                        🚀 Template Completo
                    </button>
                </div>
                <div class="resource-example">
                    <p><strong>Ejemplo de uso:</strong></p>
                    <code>rag_query("${cartucho.nombre}", "tu consulta aquí")</code>
                </div>
                ` : ''}
            </div>
        `;
    });
    
    Elements.ragContent.innerHTML = ragHtml;
}

function updateForms() {
    const agent = AppState.currentAgent;
    if (!agent) return;

    // Pestaña de Parámetros
    Elements.temperatura.value = agent.temperatura ?? 0.7;
    Elements.top_p.value = agent.top_p ?? 1.0;
    Elements.max_tokens.value = agent.max_tokens ?? 2048;

    // Pestaña de Mensajes
    const messageFields = [
        'mensaje_bienvenida_es', 'mensaje_bienvenida_en', 'mensaje_retorno_es',
        'mensaje_retorno_en', 'mensaje_despedida_es', 'mensaje_despedida_en',
        'mensaje_handoff_confirmacion_es', 'mensaje_handoff_confirmacion_en',
        'mensaje_final_tarea_es', 'mensaje_final_tarea_en'
    ];
    messageFields.forEach(field => {
        if (Elements[field]) {
            Elements[field].value = agent[field] || '';
        }
    });
}

// --- ACCIONES DE USUARIO ---

async function handleSavePrompt() {
    if (!AppState.currentAgent) return;

    // Obtener el contenido del editor
    const editorContent = AppState.editor.value();
    
    // Validación: verificar que el prompt no esté vacío
    const trimmedContent = editorContent.trim();
    if (!trimmedContent || trimmedContent.length === 0) {
        showStatus('❌ El prompt no puede estar vacío', 'error');
        setTimeout(clearStatus, 3000);
        return;
    }
    
    // Debug: verificar contenido y idioma actual
    console.log('DEBUG - Idioma actual:', AppState.currentLanguage);
    console.log('DEBUG - Contenido del editor:', editorContent);
    console.log('DEBUG - Longitud del contenido:', editorContent.length);

    const agentDataPayload = {
        system_prompt: editorContent, // Campo que espera el backend
        system_prompt_es: AppState.currentLanguage === 'es' ? editorContent : AppState.currentAgent.system_prompt_es,
        system_prompt_en: AppState.currentLanguage === 'en' ? editorContent : AppState.currentAgent.system_prompt_en,
        temperatura: parseFloat(Elements.temperatura.value),
        top_p: parseFloat(Elements.top_p.value),
        max_tokens: parseInt(Elements.max_tokens.value, 10),
        mensaje_bienvenida_es: Elements.mensaje_bienvenida_es.value,
        mensaje_bienvenida_en: Elements.mensaje_bienvenida_en.value,
        mensaje_retorno_es: Elements.mensaje_retorno_es.value,
        mensaje_retorno_en: Elements.mensaje_retorno_en.value,
        mensaje_despedida_es: Elements.mensaje_despedida_es.value,
        mensaje_despedida_en: Elements.mensaje_despedida_en.value,
        mensaje_handoff_confirmacion_es: Elements.mensaje_handoff_confirmacion_es.value,
        mensaje_handoff_confirmacion_en: Elements.mensaje_handoff_confirmacion_en.value,
        mensaje_final_tarea_es: Elements.mensaje_final_tarea_es.value,
        mensaje_final_tarea_en: Elements.mensaje_final_tarea_en.value
    };

    // Debug: verificar payload completo
    console.log('DEBUG - Payload completo:', agentDataPayload);

    try {
        showStatus('Guardando cambios...', 'saving');
        Elements.savePrompt.disabled = true;
        
        await fetchAPI(`/api/agents/${AppState.currentAgent.id}/prompt`, {
            method: 'PUT',
            body: JSON.stringify(agentDataPayload)
        });

        AppState.originalAgentState = JSON.parse(JSON.stringify(agentDataPayload));
        AppState.originalAgentState.system_prompt_es = agentDataPayload.system_prompt_es;


        showStatus('✅ Agente guardado', 'success');
        setTimeout(() => {
            clearStatus();
            checkForChanges();
        }, 3000);
    } catch (error) {
        console.error('Error guardando el agente:', error);
        showStatus('❌ Error guardando', 'error');
    }
}

function handleReset() {
    if (!AppState.originalAgentState) return;
    AppState.editor.value(AppState.originalAgentState.system_prompt_es || '');
    updateForms(); // Restaura los formularios de parámetros y mensajes
    checkForChanges();
    showStatus('Cambios reseteados', 'success');
    setTimeout(clearStatus, 2000);
}

async function handleRunValidation() {
    if (!AppState.currentAgent) {
        Elements.validationReportContainer.innerHTML = '<p class="empty-state">Por favor, selecciona un agente primero.</p>';
        return;
    }

    const agentId = AppState.currentAgent.id;
    const promptContent = AppState.editor.value();

    Elements.validationStatus.textContent = 'Validando...';
    Elements.validationStatus.className = 'save-status saving';
    Elements.validationReportContainer.innerHTML = '<p class="empty-state">Generando informe de validación...</p>';

    try {
        const response = await fetchAPI(`/api/agents/${agentId}/validate`, {
            method: 'POST',
            body: JSON.stringify({ prompt: promptContent })
        });

        let report = null;
        if (response.data) {
            if (response.data.report) {
                // Handles { data: { report: ... } }
                report = response.data.report;
            } else if (response.data.summary) {
                // Handles { data: { summary: ..., details: ... } }
                report = response.data;
            }
        }

        if (report) {
            Elements.validationReportContainer.innerHTML = formatValidationReport(report);
            Elements.validationStatus.textContent = 'Validación completada';
            Elements.validationStatus.className = 'save-status success';
        } else {
            throw new Error('La respuesta de la API no contiene un informe de validación.');
        }

    } catch (error) {
        console.error('Error en la validación:', error);
        Elements.validationReportContainer.innerHTML = `<p class="empty-state error">Error al ejecutar la validación: ${error.message}</p>`;
        Elements.validationStatus.textContent = 'Error de validación';
        Elements.validationStatus.className = 'save-status error';
    }
}

function formatValidationReport(report) {
    let html = `<h2>Informe de Validación</h2>`;
    html += `<div class="validation-summary ${report.summary.includes('problemas') ? 'summary-issues' : 'summary-ok'}">${report.summary}</div>`;
    
    html += '<h3>Detalles:</h3><ul class="validation-details">';
    report.details.forEach(detail => {
        html += `<li class="detail-item ${detail.status === 'OK' ? 'status-ok' : 'status-issue'}">
            <span class="detail-check">${detail.status === 'OK' ? '✅' : '❌'}</span>
            <span class="detail-text">${detail.check}</span>
        </li>`;
    });
    html += '</ul>';

    if (report.suggestions && report.suggestions.length > 0) {
        html += '<h3>Sugerencias:</h3><ul class="validation-suggestions">';
        report.suggestions.forEach(suggestion => {
            html += `<li>${suggestion}</li>`;
        });
        html += '</ul>';
    }

    return html;
}

async function handleGenerateSuggestion() {
    if (!AppState.currentAgent) {
        alert('Por favor, selecciona un agente primero.');
        return;
    }

    const userSuggestion = Elements.userSuggestion.value;
    const currentPrompt = AppState.editor.value();

    if (!userSuggestion) {
        alert('Por favor, escribe qué quieres mejorar o añadir.');
        return;
    }

    Elements.suggestionNotes.innerHTML = '<p class="empty-state">Generando notas...</p>';
    Elements.suggestionExample.innerHTML = '<p class="empty-state">Generando prompt mejorado...</p>';
    Elements.suggestionNotes.classList.add('loading');
    Elements.suggestionExample.classList.add('loading');
    Elements.generateSuggestionBtn.disabled = true;
    Elements.applySuggestionBtn.disabled = true;

    try {
        const response = await fetchAPI(`/api/agents/${AppState.currentAgent.id}/improve-prompt`, {
            method: 'POST',
            body: JSON.stringify({
                current_prompt: currentPrompt,
                user_suggestion: userSuggestion
            })
        });

        if (response.success && response.suggestions) {
            Elements.suggestionNotes.innerText = response.suggestions.notes || 'No se generaron notas.';
            Elements.suggestionExample.innerText = response.suggestions.example_prompt || 'No se generó un prompt de ejemplo.';
            Elements.applySuggestionBtn.disabled = false;
        } else {
            throw new Error(response.message || 'La respuesta de la API no tuvo el formato esperado.');
        }

    } catch (error) {
        Elements.suggestionNotes.innerText = `Error: ${error.message}`;
        Elements.suggestionExample.innerText = 'Ocurrió un error al generar la sugerencia.';
    } finally {
        Elements.generateSuggestionBtn.disabled = false;
        Elements.suggestionNotes.classList.remove('loading');
        Elements.suggestionExample.classList.remove('loading');
    }
}

function handleApplySuggestion() {
    const improvedPrompt = Elements.suggestionExample.innerText;
    if (improvedPrompt && !improvedPrompt.startsWith('Ocurrió un error')) {
        AppState.editor.value(improvedPrompt);
        closeModal('assistant');
    }
}

// --- HELPERS ---

function checkForChanges() {
    if (!AppState.currentAgent) return;

    const original = AppState.originalAgentState;
    let hasChanges = false;

    const currentValues = {
        system_prompt_es: AppState.editor.value(),
        temperatura: parseFloat(Elements.temperatura.value),
        top_p: parseFloat(Elements.top_p.value),
        max_tokens: parseInt(Elements.max_tokens.value, 10),
        mensaje_bienvenida_es: Elements.mensaje_bienvenida_es.value,
        mensaje_bienvenida_en: Elements.mensaje_bienvenida_en.value,
        mensaje_retorno_es: Elements.mensaje_retorno_es.value,
        mensaje_retorno_en: Elements.mensaje_retorno_en.value,
        mensaje_despedida_es: Elements.mensaje_despedida_es.value,
        mensaje_despedida_en: Elements.mensaje_despedida_en.value,
        mensaje_handoff_confirmacion_es: Elements.mensaje_handoff_confirmacion_es.value,
        mensaje_handoff_confirmacion_en: Elements.mensaje_handoff_confirmacion_en.value,
        mensaje_final_tarea_es: Elements.mensaje_final_tarea_es.value,
        mensaje_final_tarea_en: Elements.mensaje_final_tarea_en.value
    };

    for (const key in currentValues) {
        const originalValue = original[key] ?? (typeof currentValues[key] === 'number' ? 0 : '');
        const currentValue = currentValues[key];

        if (typeof originalValue === 'number' && (key === 'temperatura' || key === 'top_p')) {
            if (Math.abs(originalValue - currentValue) > 0.001) {
                hasChanges = true;
                break;
            }
        } else if (String(originalValue) !== String(currentValue)) {
            hasChanges = true;
            break;
        }
    }

    Elements.savePrompt.disabled = !hasChanges;
    Elements.savePrompt.textContent = hasChanges ? '💾 Guardar *' : '💾 Guardar';
}

function populateSelect(selectElement, data, defaultOptionText, valueKey, textKey) {
    selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
    selectElement.disabled = data.length === 0;
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item[textKey];
        selectElement.appendChild(option);
    });
}

function clearSelect(selectElement, defaultOptionText) {
    selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
    selectElement.disabled = true;
}

function clearAllData() {
    AppState.currentAgent = null;
    AppState.originalAgentState = {};
    if(AppState.editor) AppState.editor.value('');
    
    const formIds = ['temperatura', 'top_p', 'max_tokens', 'mensaje_bienvenida_es', 'mensaje_bienvenida_en', 'mensaje_retorno_es', 'mensaje_retorno_en', 'mensaje_despedida_es', 'mensaje_despedida_en', 'mensaje_handoff_confirmacion_es', 'mensaje_handoff_confirmacion_en', 'mensaje_final_tarea_es', 'mensaje_final_tarea_en'];
    formIds.forEach(id => { if(Elements[id]) Elements[id].value = ''; });

    Elements.agentInfo.innerHTML = '<p class="empty-state">Selecciona un agente.</p>';
    Elements.recursosContent.innerHTML = '<p class="empty-state">Selecciona un agente.</p>';
    Elements.handoffsContent.innerHTML = '<p class="empty-state">Selecciona un agente.</p>';
    
    Elements.savePrompt.disabled = true;
    Elements.resetPrompt.disabled = true;
}

function showStatus(message, type) {
    Elements.saveStatus.textContent = message;
    Elements.saveStatus.className = `save-status ${type}`;
}

function clearStatus() {
    Elements.saveStatus.textContent = '';
    Elements.saveStatus.className = 'save-status';
}

async function fetchAPI(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    const finalOptions = { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } };
    const response = await fetch(url, finalOptions);
    if (!response.ok) {
        const errorBody = await response.text();
        console.error('API Error Body:', errorBody);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

// --- FUNCIONES RAG HELPER ---

function insertRAGSnippet(cartridgeName) {
    const cm = AppState.editor.codemirror;
    const cursor = cm.getCursor();
    const snippet = `rag_query("${cartridgeName}", "")`;
    cm.replaceRange(snippet, cursor);
    
    // Posicionar cursor dentro de las comillas de la consulta
    const newCursor = { line: cursor.line, ch: cursor.ch + snippet.length - 2 };
    cm.setCursor(newCursor);
    cm.focus();
}

function insertRAGTemplate(cartridgeName) {
    const cm = AppState.editor.codemirror;
    const cursor = cm.getCursor();
    const template = `{
    "say": "Déjame buscar esa información...",
    "action": {
        "type": "rag_query",
        "cartridge": "${cartridgeName}",
        "query": ""
    }
}`;
    cm.replaceRange(template, cursor);
    
    // Posicionar cursor dentro de las comillas de la consulta
    const lines = template.split('\n');
    const queryLineIndex = lines.findIndex(line => line.includes('"query":'));
    const newCursor = { 
        line: cursor.line + queryLineIndex, 
        ch: lines[queryLineIndex].indexOf('""') + 1 
    };
    cm.setCursor(newCursor);
    cm.focus();
}

const theme = {
    setDark: (dark) => {
        document.body.classList.toggle('dark', !!dark);
        const thumb = Elements.themeTrack.querySelector('.thumb');
        if (thumb) { thumb.textContent = dark ? '☀️' : '🌙'; }
        localStorage.setItem('darkTheme', dark ? '1' : '0');
    },
    init: () => {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const savedTheme = localStorage.getItem('darkTheme');
        const useDark = savedTheme ? savedTheme === '1' : prefersDark;
        Elements.themeToggle.checked = useDark;
        theme.setDark(useDark);
    }
};

const language = {
    setLanguage: (lang) => {
        AppState.currentLanguage = lang;
        const thumb = Elements.langTrack.querySelector('.thumb');
        if (thumb) { 
            thumb.textContent = lang === 'en' ? 'ENG' : 'ESP'; 
        }
        localStorage.setItem('selectedLanguage', lang);
        
        // Si hay un agente seleccionado, recargar el prompt en el nuevo idioma
        if (AppState.currentAgent) {
            handleAgenteChange();
        }
    },
    init: () => {
        const savedLanguage = localStorage.getItem('selectedLanguage') || 'es';
        AppState.currentLanguage = savedLanguage;
        Elements.langToggle.checked = savedLanguage === 'en';
        
        const thumb = Elements.langTrack.querySelector('.thumb');
        if (thumb) { 
            thumb.textContent = savedLanguage === 'en' ? 'ENG' : 'ESP'; 
        }
    }
};