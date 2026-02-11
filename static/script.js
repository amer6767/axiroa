// ============= DOM ELEMENTS =============
function $(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`Element not found: ${id}`);
    return el;
}

const homePage = $('home-page');
const projectsGrid = $('projects-grid');
const modalOverlay = $('modal-overlay');
const modalClose = $('modal-close');
const modalCancel = $('modal-cancel');
const modalConfirm = $('modal-confirm');
const projectNameInput = $('project-name-input');

const workspace = $('workspace');
const backBtn = $('back-btn');
const projectNameDisplay = $('project-name-display');
const chatMessages = $('chat-messages');
const userInput = $('user-input');
const sendBtn = $('send-btn');

const buildModeBtn = $('build-mode-btn');
const planModeBtn = $('plan-mode-btn');
const uiFixModeBtn = $('ui-fix-mode-btn');
const searchBtn = $('search-btn');
const modelSelect = $('model-select');

const searchOverlay = $('search-overlay');
const searchClose = $('search-close');
const searchInput = $('search-input');
const searchResults = $('search-results');

const chatPanel = $('chat-panel');
const resizeHandle = $('resize-handle');
const codePanel = $('code-panel');

const codeTab = $('code-tab');
const previewTab = $('preview-tab');
const filePathDisplay = $('file-path');
const fileTree = $('file-tree');
const emptyFiles = $('empty-files');
const editorView = $('editor-view');
const previewView = $('preview-view');
const planView = $('plan-view');
const editorPlaceholder = $('editor-placeholder');
const codeEditor = $('code-editor');
const previewIframe = $('preview-iframe');

const buildProgress = $('build-progress');
const progressSteps = $('progress-steps');
const statusText = $('status-text');

const questionnaireOverlay = $('questionnaire-overlay');
const questionnaireClose = $('questionnaire-close');
const questionContainer = $('question-container');
const qPrev = $('q-prev');
const qSubmit = $('q-submit');
const qSkip = $('q-skip');

const homeSupabaseBtn = $('home-supabase-btn');
const workspaceSupabaseBtn = $('workspace-supabase-btn');
const supabaseOverlay = $('supabase-overlay');
const supabaseClose = $('supabase-close');
const supabaseUrl = $('supabase-url');
const supabaseKey = $('supabase-key');
const supabaseServiceKey = $('supabase-service-key');
const supabaseSave = $('supabase-save');
const supabaseDisconnect = $('supabase-disconnect');
const homeSupabaseStatus = $('home-supabase-status');
const workspaceSupabaseStatus = $('workspace-supabase-status');

const settingsBtn = $('settings-btn');
const settingsOverlay = $('settings-overlay');
const settingsClose = $('settings-close');
const settingsSave = $('settings-save');

const planContent = $('plan-content');
const approvePlanBtn = $('approve-plan-btn');
const editPlanBtn = $('edit-plan-btn');

const uploadBtn = $('upload-btn');
const fileUpload = $('file-upload');
const uploadedFilesDiv = $('uploaded-files');
const downloadBtn = $('download-btn');
const refreshPreview = $('refresh-preview');

const consolePanel = $('console-panel');
const consoleBody = $('console-body');
const consoleToggle = $('console-toggle');

const deleteAllBtn = $('delete-all-btn');

// ============= STATE =============
let currentProjectId = null;
let projects = {};
let files = {};
let folders = new Set();
let currentFile = null;
let conversationHistory = [];
let currentView = 'code';
let currentMode = 'build';
let expandedFolders = new Set();
let currentQuestionIndex = 0;
let questionnaireAnswers = {};
let pendingProjectName = '';
let currentPlan = '';
let buildSteps = [];
let supabaseConfig = null;
let uploadedFiles = [];
let isGenerating = false;

// ============= QUESTIONNAIRE CONFIG =============
const questions = [
    {
        id: 'project_type',
        title: 'What type of project?',
        subtitle: 'Select one',
        options: [
            { value: 'website', label: 'Website / Landing Page', description: 'Simple website with multiple pages' },
            { value: 'webapp', label: 'Web Application', description: 'Interactive app with user accounts' },
            { value: 'ecommerce', label: 'E-commerce Store', description: 'Online store with products' },
            { value: 'dashboard', label: 'Dashboard', description: 'Data visualization & analytics' }
        ]
    },
    {
        id: 'backend',
        title: 'Backend needed?',
        subtitle: 'Select one',
        options: [
            { value: 'frontend', label: 'Frontend only', description: 'Just the visual design' },
            { value: 'full', label: 'Full backend (Supabase)', description: 'User auth and database' }
        ]
    },
    {
        id: 'style',
        title: 'Visual style?',
        subtitle: 'Select one',
        options: [
            { value: 'modern', label: 'Modern & clean', description: 'Minimalist design' },
            { value: 'colorful', label: 'Colorful & vibrant', description: 'Bold colors' },
            { value: 'premium', label: 'Premium & dark', description: 'Elegant high-end feel' }
        ]
    }
];

// ============= INITIALIZE =============
document.addEventListener('DOMContentLoaded', init);

function init() {
    console.log('Initializing Axiroa...');
    loadProjects();
    loadSupabaseConfig();
    setupEventListeners();
    initResize();
    initSupabaseTabs();
    console.log('Axiroa initialized!');
}

function setupEventListeners() {
    // Modal
    if (modalClose) modalClose.onclick = hideModal;
    if (modalCancel) modalCancel.onclick = hideModal;
    if (modalConfirm) modalConfirm.onclick = confirmNewProject;
    if (modalOverlay) modalOverlay.onclick = (e) => { if (e.target === modalOverlay) hideModal(); };
    if (projectNameInput) projectNameInput.onkeydown = (e) => { if (e.key === 'Enter') confirmNewProject(); };

    // Back
    if (backBtn) backBtn.onclick = goBack;

    // Mode buttons
    if (buildModeBtn) buildModeBtn.onclick = () => setMode('build');
    if (planModeBtn) planModeBtn.onclick = () => setMode('plan');
    if (uiFixModeBtn) uiFixModeBtn.onclick = () => setMode('ui_fix');

    // Tabs
    if (codeTab) codeTab.onclick = () => switchView('code');
    if (previewTab) previewTab.onclick = () => switchView('preview');

    // Chat
    if (userInput) {
        userInput.oninput = onInputChange;
        userInput.onkeydown = onInputKeydown;
    }
    if (sendBtn) sendBtn.onclick = sendMessage;

    // Search
    if (searchBtn) searchBtn.onclick = openSearch;
    if (searchClose) searchClose.onclick = closeSearch;
    if (searchOverlay) searchOverlay.onclick = (e) => { if (e.target === searchOverlay) closeSearch(); };
    if (searchInput) searchInput.onkeydown = onSearchKeydown;

    // Questionnaire
    if (questionnaireClose) questionnaireClose.onclick = closeQuestionnaire;
    if (qPrev) qPrev.onclick = prevQuestion;
    if (qSubmit) qSubmit.onclick = submitQuestion;
    if (qSkip) qSkip.onclick = skipQuestionnaire;
    if (questionnaireOverlay) questionnaireOverlay.onclick = (e) => { if (e.target === questionnaireOverlay) closeQuestionnaire(); };

    // Supabase
    if (homeSupabaseBtn) homeSupabaseBtn.onclick = openSupabaseSettings;
    if (workspaceSupabaseBtn) workspaceSupabaseBtn.onclick = openSupabaseSettings;
    if (supabaseClose) supabaseClose.onclick = closeSupabaseSettings;
    if (supabaseSave) supabaseSave.onclick = saveSupabase;
    if (supabaseDisconnect) supabaseDisconnect.onclick = disconnectSupabase;
    if (supabaseOverlay) supabaseOverlay.onclick = (e) => { if (e.target === supabaseOverlay) closeSupabaseSettings(); };

    // Settings
    if (settingsBtn) settingsBtn.onclick = openSettings;
    if (settingsClose) settingsClose.onclick = closeSettings;
    if (settingsSave) settingsSave.onclick = closeSettings;
    if (settingsOverlay) settingsOverlay.onclick = (e) => { if (e.target === settingsOverlay) closeSettings(); };

    // Delete all
    if (deleteAllBtn) deleteAllBtn.onclick = deleteAllProjects;

    // Plan
    if (approvePlanBtn) approvePlanBtn.onclick = approvePlan;
    if (editPlanBtn) editPlanBtn.onclick = () => userInput?.focus();

    // Editor
    if (codeEditor) codeEditor.oninput = onEditorChange;

    // Download
    if (downloadBtn) downloadBtn.onclick = downloadProject;

    // Upload
    if (uploadBtn) uploadBtn.onclick = () => fileUpload?.click();
    if (fileUpload) fileUpload.onchange = handleFileUpload;

    // Preview refresh
    if (refreshPreview) refreshPreview.onclick = updatePreview;

    // Console toggle
    if (consoleToggle) consoleToggle.onclick = toggleConsole;

    // Suggestion chips
    document.querySelectorAll('.chip[data-prompt]').forEach(chip => {
        chip.onclick = () => {
            if (userInput) {
                userInput.value = chip.dataset.prompt;
                onInputChange();
                sendMessage();
            }
        };
    });

    // Keyboard
    document.onkeydown = onGlobalKeydown;
}

// ============= RESIZE =============
function initResize() {
    if (!resizeHandle || !chatPanel) return;
    let isResizing = false;

    resizeHandle.onmousedown = () => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        resizeHandle.classList.add('active');
    };

    document.onmousemove = (e) => {
        if (!isResizing) return;
        if (e.clientX > 320 && e.clientX < 700) {
            chatPanel.style.width = e.clientX + 'px';
        }
    };

    document.onmouseup = () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            resizeHandle.classList.remove('active');
        }
    };
}

// ============= SETTINGS =============
function openSettings() {
    if (settingsOverlay) {
        settingsOverlay.style.display = 'flex';
        settingsOverlay.offsetHeight;
        settingsOverlay.classList.add('active');
    }
}

function closeSettings() {
    if (settingsOverlay) {
        settingsOverlay.classList.remove('active');
        setTimeout(() => settingsOverlay.style.display = 'none', 250);
    }
}

function deleteAllProjects() {
    if (confirm('Delete all projects? This cannot be undone.')) {
        projects = {};
        saveProjects();
        renderProjects();
        closeSettings();
    }
}

// ============= SUPABASE =============
const supabaseTest = $('supabase-test');

function loadSupabaseConfig() {
    try {
        const saved = localStorage.getItem('axiroa_supabase');
        if (saved) {
            supabaseConfig = JSON.parse(saved);
            if (supabaseUrl) supabaseUrl.value = supabaseConfig.url || '';
            if (supabaseKey) supabaseKey.value = supabaseConfig.key || '';
            if (supabaseServiceKey) supabaseServiceKey.value = supabaseConfig.serviceKey || '';
            // Restore auth provider toggles
            const authProviders = supabaseConfig.authProviders || {};
            const authEmail = document.getElementById('auth-email');
            const authGoogle = document.getElementById('auth-google');
            const authGithub = document.getElementById('auth-github');
            const authMagic = document.getElementById('auth-magic');
            if (authEmail) authEmail.checked = authProviders.email !== false;
            if (authGoogle) authGoogle.checked = !!authProviders.google;
            if (authGithub) authGithub.checked = !!authProviders.github;
            if (authMagic) authMagic.checked = !!authProviders.magic;
            updateSupabaseStatus();
            updateSupabaseBanner();
        }
    } catch (e) {
        console.error('Failed to load Supabase config:', e);
    }
}

function getAuthProviders() {
    return {
        email: document.getElementById('auth-email')?.checked ?? true,
        google: document.getElementById('auth-google')?.checked ?? false,
        github: document.getElementById('auth-github')?.checked ?? false,
        magic: document.getElementById('auth-magic')?.checked ?? false
    };
}

function saveSupabase() {
    const url = supabaseUrl?.value?.trim() || '';
    const key = supabaseKey?.value?.trim() || '';
    if (!url || !key) {
        setSupabaseBanner('disconnected', 'Missing credentials', 'Please enter both Project URL and Anon Key');
        // Switch to credentials tab
        switchSupabaseTab('credentials');
        return;
    }
    supabaseConfig = {
        url: url,
        key: key,
        serviceKey: supabaseServiceKey?.value?.trim() || '',
        authProviders: getAuthProviders()
    };
    localStorage.setItem('axiroa_supabase', JSON.stringify(supabaseConfig));
    updateSupabaseStatus();
    setSupabaseBanner('connected', 'Connected', url.replace('https://', '').replace('.supabase.co', ''));
    closeSupabaseSettings();
    logConsole('Supabase connected: ' + url, 'success');
}

async function testSupabaseConnection() {
    const url = supabaseUrl?.value?.trim();
    const key = supabaseKey?.value?.trim();
    if (!url || !key) {
        setSupabaseBanner('disconnected', 'Missing credentials', 'Enter Project URL and Anon Key first');
        switchSupabaseTab('credentials');
        return;
    }
    // Show testing state
    setSupabaseBanner('testing', 'Testing connection...', url.replace('https://', ''));
    const testBtn = supabaseTest;
    if (testBtn) {
        testBtn.classList.add('testing');
        testBtn.innerHTML = '<i class="fa-solid fa-spinner"></i> Testing...';
    }
    try {
        const response = await fetch(url + '/rest/v1/', {
            method: 'GET',
            headers: {
                'apikey': key,
                'Authorization': 'Bearer ' + key
            }
        });
        if (response.ok || response.status === 200) {
            setSupabaseBanner('connected', 'Connection successful!', url.replace('https://', '').replace('.supabase.co', ''));
            logConsole('Supabase connection test: SUCCESS', 'success');
        } else {
            setSupabaseBanner('disconnected', `Connection failed (${response.status})`, 'Check your credentials and try again');
            logConsole('Supabase connection test: FAILED (' + response.status + ')', 'error');
        }
    } catch (err) {
        setSupabaseBanner('disconnected', 'Connection failed', err.message || 'Network error');
        logConsole('Supabase connection test: ERROR - ' + err.message, 'error');
    } finally {
        if (testBtn) {
            testBtn.classList.remove('testing');
            testBtn.innerHTML = '<i class="fa-solid fa-plug-circle-check"></i> Test';
        }
    }
}

function setSupabaseBanner(state, main, sub) {
    const icon = document.getElementById('supabase-conn-icon');
    const text = document.getElementById('supabase-conn-text');
    const subText = document.getElementById('supabase-conn-sub');
    if (icon) {
        icon.className = 'status-icon ' + state;
        if (state === 'connected') icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        else if (state === 'testing') icon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        else icon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
    }
    if (text) text.textContent = main;
    if (subText) subText.textContent = sub;
}

function updateSupabaseBanner() {
    if (supabaseConfig?.url && supabaseConfig?.key) {
        setSupabaseBanner('connected', 'Connected', supabaseConfig.url.replace('https://', '').replace('.supabase.co', ''));
    } else {
        setSupabaseBanner('disconnected', 'Not connected', 'Enter your project credentials below');
    }
}

function switchSupabaseTab(tabId) {
    document.querySelectorAll('.supabase-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.supabase-tab-content').forEach(c => c.classList.remove('active'));
    const tab = document.querySelector(`.supabase-tab[data-tab="${tabId}"]`);
    const content = document.getElementById('tab-' + tabId);
    if (tab) tab.classList.add('active');
    if (content) content.classList.add('active');
}

function initSupabaseTabs() {
    document.querySelectorAll('.supabase-tab').forEach(tab => {
        tab.onclick = () => switchSupabaseTab(tab.dataset.tab);
    });
    if (supabaseTest) supabaseTest.onclick = testSupabaseConnection;
}

function disconnectSupabase() {
    supabaseConfig = null;
    localStorage.removeItem('axiroa_supabase');
    if (supabaseUrl) supabaseUrl.value = '';
    if (supabaseKey) supabaseKey.value = '';
    if (supabaseServiceKey) supabaseServiceKey.value = '';
    // Reset auth toggles
    const authEmail = document.getElementById('auth-email');
    const authGoogle = document.getElementById('auth-google');
    const authGithub = document.getElementById('auth-github');
    const authMagic = document.getElementById('auth-magic');
    if (authEmail) authEmail.checked = true;
    if (authGoogle) authGoogle.checked = false;
    if (authGithub) authGithub.checked = false;
    if (authMagic) authMagic.checked = false;
    updateSupabaseStatus();
    setSupabaseBanner('disconnected', 'Disconnected', 'Enter your project credentials below');
    logConsole('Supabase disconnected', 'info');
}

function updateSupabaseStatus() {
    const connected = supabaseConfig?.url && supabaseConfig?.key;
    if (homeSupabaseStatus) homeSupabaseStatus.classList.toggle('connected', !!connected);
    if (workspaceSupabaseStatus) workspaceSupabaseStatus.classList.toggle('connected', !!connected);
}

function openSupabaseSettings() {
    updateSupabaseBanner();
    switchSupabaseTab('credentials');
    if (supabaseOverlay) {
        supabaseOverlay.style.display = 'flex';
        supabaseOverlay.offsetHeight;
        supabaseOverlay.classList.add('active');
    }
}

function closeSupabaseSettings() {
    if (supabaseOverlay) {
        supabaseOverlay.classList.remove('active');
        setTimeout(() => supabaseOverlay.style.display = 'none', 250);
    }
}

// ============= UPLOAD / DOWNLOAD =============
function handleFileUpload(e) {
    const fileList = e.target.files;
    if (!fileList.length) return;

    Array.from(fileList).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const isImage = file.type.startsWith('image/');
            const isText = file.type.startsWith('text/') ||
                /\.(html|css|js|json|md|txt|svg|xml|yaml|yml|toml|py|rb|java|php|tsx|jsx|ts)$/i.test(file.name);

            if (isImage || isText) {
                uploadedFiles.push({
                    name: file.name,
                    type: file.type,
                    data: event.target.result,
                    isImage
                });
                renderUploadedFiles();
            }
        };

        if (file.type.startsWith('image/')) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    });

    fileUpload.value = '';
}

function renderUploadedFiles() {
    if (!uploadedFilesDiv) return;

    if (uploadedFiles.length === 0) {
        uploadedFilesDiv.style.display = 'none';
        return;
    }

    uploadedFilesDiv.style.display = 'flex';
    uploadedFilesDiv.innerHTML = uploadedFiles.map((f, i) => `
        <div class="uploaded-file">
            <i class="fa-solid ${f.isImage ? 'fa-image' : 'fa-file'}"></i>
            <span>${f.name}</span>
            <button class="remove-file" data-index="${i}">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');

    uploadedFilesDiv.querySelectorAll('.remove-file').forEach(btn => {
        btn.onclick = () => {
            uploadedFiles.splice(parseInt(btn.dataset.index), 1);
            renderUploadedFiles();
        };
    });
}

async function downloadProject() {
    if (!currentProjectId) return;

    try {
        await fetch(`/projects/${currentProjectId}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files })
        });

        const link = document.createElement('a');
        link.href = `/projects/${currentProjectId}/download`;
        link.download = `${currentProjectId}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error('Download failed:', e);
    }
}

// ============= CONSOLE =============
function logToConsole(message, type = '') {
    if (!consoleBody || !consolePanel) return;
    consolePanel.style.display = 'block';
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.textContent = `> ${message}`;
    consoleBody.appendChild(line);
    consoleBody.scrollTop = consoleBody.scrollHeight;
}

function clearConsole() {
    if (consoleBody) consoleBody.innerHTML = '';
}

function toggleConsole() {
    if (!consoleBody) return;
    const isHidden = consoleBody.style.display === 'none';
    consoleBody.style.display = isHidden ? 'block' : 'none';
}

// ============= QUESTIONNAIRE =============
function showQuestionnaire(projectName) {
    pendingProjectName = projectName;
    currentQuestionIndex = 0;
    questionnaireAnswers = {};
    renderQuestion();
    if (questionnaireOverlay) {
        questionnaireOverlay.style.display = 'flex';
        questionnaireOverlay.offsetHeight;
        questionnaireOverlay.classList.add('active');
    }
}

function closeQuestionnaire() {
    if (questionnaireOverlay) {
        questionnaireOverlay.classList.remove('active');
        setTimeout(() => questionnaireOverlay.style.display = 'none', 250);
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

function submitQuestion() {
    if (currentQuestionIndex < questions.length) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        finishQuestionnaire();
    }
}

function skipQuestionnaire() {
    finishQuestionnaire();
}

function renderQuestion() {
    if (!questionContainer) return;

    if (currentQuestionIndex >= questions.length) {
        renderSummary();
        return;
    }

    const q = questions[currentQuestionIndex];
    const selectedValue = questionnaireAnswers[q.id];

    questionContainer.innerHTML = `
        <div class="question-title">${q.title}</div>
        <div class="question-subtitle">${q.subtitle}</div>
        <div class="question-options">
            ${q.options.map(opt => `
                <div class="question-option ${selectedValue === opt.value ? 'selected' : ''}" data-value="${opt.value}">
                    <div class="option-radio"></div>
                    <div class="option-content">
                        <div class="option-label">${opt.label}</div>
                        <div class="option-description">${opt.description}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    questionContainer.querySelectorAll('.question-option').forEach(opt => {
        opt.onclick = () => {
            questionContainer.querySelectorAll('.question-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            questionnaireAnswers[q.id] = opt.dataset.value;
        };
    });

    updateQuestionnaireNav();
}

function renderSummary() {
    if (!questionContainer) return;

    questionContainer.innerHTML = `
        <div class="question-title">Review your choices</div>
        <div class="question-subtitle">Ready to create your project</div>
        <div class="question-summary">
            ${questions.map(q => {
        const answer = questionnaireAnswers[q.id];
        const option = q.options.find(o => o.value === answer);
        return `
                    <div class="summary-item">
                        <div class="summary-label">${q.title.replace('?', '')}</div>
                        <div class="summary-value">${option?.label || 'Not specified'}</div>
                    </div>
                `;
    }).join('')}
        </div>
    `;

    if (qSubmit) qSubmit.textContent = 'Create Project';
    updateQuestionnaireNav();
}

function updateQuestionnaireNav() {
    if (qPrev) qPrev.disabled = currentQuestionIndex === 0;
    if (qSubmit) qSubmit.textContent = currentQuestionIndex >= questions.length ? 'Create Project' : 'Next';
}

function finishQuestionnaire() {
    closeQuestionnaire();

    const id = 'proj_' + Date.now();
    projects[id] = {
        name: pendingProjectName,
        files: {},
        folders: [],
        history: [],
        questionnaire: questionnaireAnswers
    };
    saveProjects();
    openProject(id);
}

// ============= MODAL =============
function showModal() {
    if (projectNameInput) projectNameInput.value = 'My Project';
    if (modalOverlay) {
        modalOverlay.style.display = 'flex';
        modalOverlay.offsetHeight;
        modalOverlay.classList.add('active');
        setTimeout(() => projectNameInput?.focus(), 100);
    }
}

function hideModal() {
    if (modalOverlay) {
        modalOverlay.classList.remove('active');
        setTimeout(() => modalOverlay.style.display = 'none', 250);
    }
}

function confirmNewProject() {
    const name = projectNameInput?.value?.trim() || 'Untitled';
    hideModal();
    showQuestionnaire(name);
}

// ============= PROJECTS =============
function loadProjects() {
    try {
        const saved = localStorage.getItem('axiroa_projects');
        if (saved) projects = JSON.parse(saved);
    } catch (e) {
        projects = {};
    }
    renderProjects();
}

function saveProjects() {
    try {
        localStorage.setItem('axiroa_projects', JSON.stringify(projects));
    } catch (e) {
        console.error('Save failed:', e);
    }
}

function renderProjects() {
    if (!projectsGrid) return;

    projectsGrid.innerHTML = '';

    // New Project Card
    const newCard = document.createElement('div');
    newCard.className = 'project-card new-project-card';
    newCard.innerHTML = `<i class="fa-solid fa-plus"></i><span>New Project</span>`;
    newCard.onclick = showModal;
    projectsGrid.appendChild(newCard);

    // Existing Projects
    Object.entries(projects).forEach(([id, project]) => {
        const card = document.createElement('div');
        card.className = 'project-card';
        const fileCount = Object.keys(project.files || {}).length;
        card.innerHTML = `
            <div class="project-actions">
                <button class="project-delete-btn" data-id="${id}" title="Delete project">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="project-icon"><i class="fa-solid fa-code"></i></div>
            <div class="project-title">${project.name || 'Untitled'}</div>
            <div class="project-meta">
                <span>${fileCount} file${fileCount !== 1 ? 's' : ''}</span>
            </div>
        `;
        card.onclick = (e) => {
            if (e.target.closest('.project-delete-btn')) {
                e.stopPropagation();
                deleteProject(id);
                return;
            }
            openProject(id);
        };
        projectsGrid.appendChild(card);
    });
}

function deleteProject(id) {
    if (confirm(`Delete "${projects[id]?.name || 'this project'}"?`)) {
        delete projects[id];
        saveProjects();
        renderProjects();
    }
}

function openProject(id) {
    currentProjectId = id;
    const project = projects[id];
    if (!project) return;

    if (projectNameDisplay) projectNameDisplay.textContent = project.name || 'Untitled';
    files = project.files || {};
    folders = new Set(project.folders || []);
    conversationHistory = project.history || [];
    currentFile = null;
    currentMode = 'build';
    expandedFolders = new Set();
    currentPlan = '';
    uploadedFiles = [];
    isGenerating = false;

    updateModeUI();
    syncProjectWithBackend();

    if (homePage) homePage.style.display = 'none';
    if (workspace) workspace.style.display = 'flex';

    if (consolePanel) consolePanel.style.display = 'none';
    clearConsole();

    renderChat();
    renderFileTree();
    renderUploadedFiles();
}

function goBack() {
    if (currentProjectId && projects[currentProjectId]) {
        projects[currentProjectId].files = files;
        projects[currentProjectId].folders = [...folders];
        projects[currentProjectId].history = conversationHistory;
        saveProjects();
    }
    if (workspace) workspace.style.display = 'none';
    if (homePage) homePage.style.display = 'flex';
    currentProjectId = null;
    renderProjects();
}

function renderChat() {
    if (!chatMessages) return;

    if (conversationHistory.length === 0) {
        chatMessages.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                </div>
                <h3>What would you like to build?</h3>
                <p>I can create, edit, and fix your code in real-time.</p>
                <div class="suggestion-chips">
                    <button class="chip" data-prompt="Build a modern todo app with local storage">📝 Todo App</button>
                    <button class="chip" data-prompt="Build a calculator with a sleek dark UI">🧮 Calculator</button>
                    <button class="chip" data-prompt="Build a personal portfolio website with animations">🌐 Portfolio</button>
                </div>
            </div>
        `;
        // Re-attach chip handlers
        chatMessages.querySelectorAll('.chip[data-prompt]').forEach(chip => {
            chip.onclick = () => {
                if (userInput) {
                    userInput.value = chip.dataset.prompt;
                    onInputChange();
                    sendMessage();
                }
            };
        });
    } else {
        chatMessages.innerHTML = '';
        conversationHistory.forEach(msg => {
            if (msg.role === 'user') addMessage(msg.content, 'user');
            else if (msg.role === 'assistant' && msg.content) addMessage(msg.content, 'bot');
        });
    }
}

async function syncProjectWithBackend() {
    try {
        await fetch(`/projects/${currentProjectId}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files })
        });
    } catch (e) {
        console.error('Sync failed:', e);
    }
}

// ============= MODE =============
function setMode(mode) {
    currentMode = mode;
    updateModeUI();
}

function updateModeUI() {
    if (buildModeBtn) buildModeBtn.classList.toggle('active', currentMode === 'build');
    if (planModeBtn) planModeBtn.classList.toggle('active', currentMode === 'plan');
    if (uiFixModeBtn) uiFixModeBtn.classList.toggle('active', currentMode === 'ui_fix');

    const placeholders = {
        'build': "Describe what you want to build...",
        'plan': "Describe your project for planning...",
        'ui_fix': "Describe the UI issue to fix..."
    };

    if (userInput) userInput.placeholder = placeholders[currentMode] || placeholders.build;

    const statusColors = { 'build': '#10b981', 'plan': '#f59e0b', 'ui_fix': '#8b5cf6' };
    const statusLabels = { 'build': 'Ready', 'plan': 'Planning', 'ui_fix': 'UI Fix' };

    const statusPulse = document.querySelector('.status-pulse');
    if (statusPulse) statusPulse.style.background = statusColors[currentMode];
    if (statusText) statusText.textContent = statusLabels[currentMode];

    if (currentMode === 'plan' && currentPlan) {
        showPlanView();
    } else {
        hidePlanView();
    }
}

function showPlanView() {
    if (editorView) editorView.style.display = 'none';
    if (previewView) previewView.style.display = 'none';
    if (planView) {
        planView.style.display = 'flex';
        if (planContent && typeof marked !== 'undefined') {
            planContent.innerHTML = marked.parse(currentPlan);
        }
    }
}

function hidePlanView() {
    if (planView) planView.style.display = 'none';
    if (currentView === 'code') {
        if (editorView) editorView.style.display = 'flex';
    } else {
        if (previewView) previewView.style.display = 'flex';
    }
}

function approvePlan() {
    setMode('build');
    if (userInput) {
        userInput.value = "I approve this plan. Please start building.";
        sendMessage();
    }
}

// ============= SEARCH =============
function openSearch() {
    if (searchOverlay) {
        searchOverlay.style.display = 'flex';
        searchOverlay.offsetHeight;
        searchOverlay.classList.add('active');
        setTimeout(() => searchInput?.focus(), 100);
    }
}

function closeSearch() {
    if (searchOverlay) {
        searchOverlay.classList.remove('active');
        setTimeout(() => searchOverlay.style.display = 'none', 250);
    }
}

async function onSearchKeydown(e) {
    if (e.key !== 'Enter' || !searchInput) return;

    const query = searchInput.value.trim();
    if (!query || !searchResults) return;

    searchResults.innerHTML = '<div style="padding:1rem;color:#888;"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</div>';

    try {
        const response = await fetch('/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        let result = '';
        searchResults.innerHTML = '';

        await processSSEStream(response, {
            onText: (text) => {
                result += text;
                searchResults.innerHTML = typeof marked !== 'undefined' ? marked.parse(result) : result;
            }
        });
    } catch (error) {
        searchResults.innerHTML = `<div style="color:#ef4444;padding:1rem;">Error: ${error.message}</div>`;
    }
}

// ============= BUILD PROGRESS =============
function showBuildProgress(steps) {
    buildSteps = steps;
    if (buildProgress) buildProgress.style.display = 'block';
    renderBuildSteps();
}

function hideBuildProgress() {
    if (buildProgress) buildProgress.style.display = 'none';
}

function renderBuildSteps() {
    if (!progressSteps) return;
    progressSteps.innerHTML = buildSteps.map(step => `
        <div class="progress-step ${step.status}">
            <div class="step-indicator">
                ${step.status === 'complete' ? '<i class="fa-solid fa-check"></i>' : ''}
            </div>
            <span>${step.label}</span>
        </div>
    `).join('');
}

function updateBuildStep(index, status) {
    if (buildSteps[index]) {
        buildSteps[index].status = status;
        renderBuildSteps();
    }
}

// ============= SSE STREAM PARSER =============
async function processSSEStream(response, handlers) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by double newlines)
        const events = buffer.split('\n\n');
        buffer = events.pop(); // Keep incomplete event in buffer

        for (const eventStr of events) {
            if (!eventStr.trim()) continue;

            let eventType = '';
            let eventData = '';

            const lines = eventStr.split('\n');
            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    eventType = line.slice(7).trim();
                } else if (line.startsWith('data: ')) {
                    eventData = line.slice(6);
                }
            }

            if (!eventType || !eventData) continue;

            try {
                const data = JSON.parse(eventData);

                switch (eventType) {
                    case 'text':
                        if (handlers.onText) handlers.onText(data.content || '');
                        break;
                    case 'tool_call':
                        if (handlers.onToolCall) handlers.onToolCall(data);
                        break;
                    case 'plan':
                        if (handlers.onPlan) handlers.onPlan(data.content || '');
                        break;
                    case 'error':
                        if (handlers.onError) handlers.onError(data.message || 'Unknown error');
                        break;
                    case 'done':
                        if (handlers.onDone) handlers.onDone();
                        break;
                }
            } catch (parseErr) {
                console.error('SSE parse error:', parseErr, eventData);
            }
        }
    }
}

// ============= CHAT INPUT =============
function onInputChange() {
    if (!userInput) return;
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
    if (sendBtn) sendBtn.disabled = userInput.value.trim().length === 0;
}

function onInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// ============= SEND MESSAGE =============
async function sendMessage() {
    if (!userInput || isGenerating) return;

    const message = userInput.value.trim();
    if (!message || !currentProjectId) return;

    isGenerating = true;

    // Remove empty state
    const emptyState = chatMessages?.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    // Include uploaded files in message
    let fullMessage = message;
    if (uploadedFiles.length > 0) {
        const fileDescriptions = uploadedFiles.map(f =>
            f.isImage ? `[Image: ${f.name}]` : `[File: ${f.name}]\n${f.data.substring(0, 500)}...`
        ).join('\n');
        fullMessage = `${message}\n\nUploaded files:\n${fileDescriptions}`;

        uploadedFiles.forEach(f => {
            if (f.isImage) {
                files[f.name] = f.data;
            }
        });
    }

    addMessage(message, 'user');
    conversationHistory.push({ role: 'user', content: fullMessage });

    userInput.value = '';
    userInput.style.height = 'auto';
    if (sendBtn) sendBtn.disabled = true;

    // Clear uploaded files
    uploadedFiles = [];
    renderUploadedFiles();

    // Clear console
    clearConsole();

    const botDiv = addMessage('', 'bot');
    const contentDiv = botDiv?.querySelector('.message-content');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="thinking-indicator">
                <div class="thinking-dots"><span></span><span></span><span></span></div>
                <span>Thinking...</span>
            </div>
        `;
    }

    // Show build progress
    if (currentMode === 'build' || currentMode === 'ui_fix') {
        showBuildProgress([
            { label: 'Understanding request', status: 'active' },
            { label: 'Analyzing files', status: '' },
            { label: 'Making changes', status: '' },
            { label: 'Finalizing', status: '' }
        ]);
    }

    // Update status
    if (statusText) statusText.textContent = 'Generating...';
    const statusPulse = document.querySelector('.status-pulse');
    if (statusPulse) statusPulse.style.background = '#f59e0b';

    try {
        const requestBody = {
            message: fullMessage,
            project_id: currentProjectId,
            history: conversationHistory.slice(-20),
            mode: currentMode,
            model: modelSelect?.value || 'llama-3.3-70b',
            uploaded_files: uploadedFiles.map(f => f.name)
        };

        if (supabaseConfig?.url) {
            requestBody.supabase = supabaseConfig;
        }

        if (projects[currentProjectId]?.questionnaire) {
            requestBody.questionnaire = projects[currentProjectId].questionnaire;
        }

        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (contentDiv) contentDiv.innerHTML = '';
        let fullText = '';
        let stepIndex = 0;
        let toolElements = [];

        await processSSEStream(response, {
            onText: (text) => {
                fullText += text;
                if (contentDiv && fullText.trim() && typeof marked !== 'undefined') {
                    const toolsHTML = toolElements.map(el => el.outerHTML).join('');
                    contentDiv.innerHTML = marked.parse(fullText) + toolsHTML;
                }
                if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
            },

            onToolCall: (toolData) => {
                if (contentDiv) {
                    const toolEl = createToolCallElement(toolData);
                    toolElements.push(toolEl);
                    contentDiv.appendChild(toolEl);
                }

                // Update files based on tool result
                handleToolResult(toolData);

                // Log to console
                const name = toolData.name;
                const success = toolData.result?.success;
                const msg = toolData.result?.message || toolData.result?.error || '';
                logToConsole(`${name}: ${msg}`, success ? 'success' : (toolData.result?.error ? 'error' : 'info'));

                // Update build steps
                if (stepIndex < buildSteps.length) {
                    updateBuildStep(stepIndex, 'complete');
                    stepIndex++;
                    if (stepIndex < buildSteps.length) {
                        updateBuildStep(stepIndex, 'active');
                    }
                }

                if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
            },

            onPlan: (planText) => {
                currentPlan = planText;
                if (currentMode === 'plan') showPlanView();
            },

            onError: (errorMsg) => {
                if (contentDiv) {
                    contentDiv.innerHTML += `<div style="color:var(--error);margin-top:0.5rem;font-size:0.85rem;">⚠ Error: ${errorMsg}</div>`;
                }
                logToConsole(`Error: ${errorMsg}`, 'error');
            },

            onDone: () => {
                // Complete all steps
                buildSteps.forEach((_, i) => updateBuildStep(i, 'complete'));
                setTimeout(hideBuildProgress, 1500);
            }
        });

        if (fullText.trim()) {
            conversationHistory.push({ role: 'assistant', content: fullText });
        }

        // Save and update
        if (projects[currentProjectId]) {
            projects[currentProjectId].files = files;
            projects[currentProjectId].folders = [...folders];
            projects[currentProjectId].history = conversationHistory;
            saveProjects();
        }

        renderFileTree();
        if (currentView === 'preview') updatePreview();

    } catch (error) {
        if (contentDiv) {
            contentDiv.innerHTML += `<div style="color:var(--error);margin-top:0.5rem;">Error: ${error.message}</div>`;
        }
        hideBuildProgress();
    } finally {
        isGenerating = false;
        if (statusText) statusText.textContent = currentMode === 'build' ? 'Ready' : currentMode === 'plan' ? 'Planning' : 'UI Fix';
        const sp = document.querySelector('.status-pulse');
        const statusColors = { 'build': '#10b981', 'plan': '#f59e0b', 'ui_fix': '#8b5cf6' };
        if (sp) sp.style.background = statusColors[currentMode];
    }
}

function createToolCallElement(toolData) {
    const { name, result } = toolData;
    const args = toolData.args || {};

    const div = document.createElement('div');
    div.className = `tool-call ${result?.success === false ? 'error' : ''}`;

    let icon = 'fa-gear';
    let text = '';
    const path = args?.path || args?.filename || result?.path || '';

    switch (name) {
        case 'create_file': icon = 'fa-file-circle-plus'; text = `Created ${path}`; break;
        case 'edit_file': icon = 'fa-file-pen'; text = result?.success ? `Edited ${path}` : `Edit failed: ${path}`; break;
        case 'rewrite_file': icon = 'fa-file-pen'; text = `Rewrote ${path}`; break;
        case 'read_file': icon = 'fa-file-code'; text = `Read ${path}`; break;
        case 'delete_file': icon = 'fa-trash'; text = `Deleted ${path}`; break;
        case 'rename_file': icon = 'fa-file-arrow-up'; text = `Renamed → ${result?.new_path || args?.new_path}`; break;
        case 'list_files': icon = 'fa-folder-open'; text = 'Listed files'; break;
        case 'search_in_files': icon = 'fa-magnifying-glass'; text = `Found ${result?.count || 0} matches`; break;
        case 'batch_create_files': icon = 'fa-layer-group'; text = `Created ${result?.created?.length || 'multiple'} files`; break;
        case 'get_file_structure': icon = 'fa-sitemap'; text = 'Got file structure'; break;
        case 'supabase_sql': icon = 'fa-database'; text = 'Executed SQL'; break;
        case 'supabase_create_table': icon = 'fa-database'; text = `Created table ${args?.table_name}`; break;
        case 'supabase_insert': icon = 'fa-database'; text = `Inserted into ${args?.table}`; break;
        case 'supabase_select': icon = 'fa-database'; text = `Queried ${args?.table}`; break;
        default: text = name; break;
    }

    div.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${text}</span>`;
    return div;
}

function handleToolResult(toolData) {
    const { name, result } = toolData;

    if (!result?.success) return;

    if (name === 'create_file' || name === 'edit_file' || name === 'rewrite_file') {
        if (result.path && result.content !== undefined) {
            files[result.path] = result.content;
            autoExpandPath(result.path);
            renderFileTree();
            selectFile(result.path);
        }
    } else if (name === 'batch_create_files') {
        if (result.files) {
            // Merge all created files
            Object.entries(result.files).forEach(([path, content]) => {
                files[path] = content;
                autoExpandPath(path);
            });
            renderFileTree();
            // Select the first HTML file or the first file
            const created = result.created || Object.keys(result.files);
            const htmlFile = created.find(f => f.endsWith('.html'));
            if (htmlFile) {
                selectFile(htmlFile);
            } else if (created.length > 0) {
                selectFile(created[0]);
            }
        }
    } else if (name === 'rename_file') {
        if (result.new_path) {
            const oldPath = result.old_path || toolData.args?.old_path;
            if (oldPath) delete files[oldPath];
            files[result.new_path] = result.content;
            renderFileTree();
            selectFile(result.new_path);
        }
    } else if (name === 'delete_file') {
        const path = result.path || toolData.args?.path;
        if (path) {
            delete files[path];
            if (currentFile === path) {
                currentFile = null;
                if (editorPlaceholder) editorPlaceholder.style.display = 'flex';
                if (codeEditor) codeEditor.style.display = 'none';
            }
            renderFileTree();
        }
    }
}

function autoExpandPath(path) {
    if (path.includes('/')) {
        const parts = path.split('/');
        for (let i = 1; i < parts.length; i++) {
            expandedFolders.add(parts.slice(0, i).join('/'));
        }
    }
}

function addMessage(text, sender) {
    if (!chatMessages) return null;

    const div = document.createElement('div');
    div.className = `message ${sender}`;

    const parsed = sender === 'bot' && typeof marked !== 'undefined' && text ? marked.parse(text) : text;

    div.innerHTML = `
        <div class="avatar">
            <i class="fa-solid ${sender === 'user' ? 'fa-user' : 'fa-robot'}"></i>
        </div>
        <div class="message-content">${parsed}</div>
    `;

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}

// ============= FILE TREE =============
function renderFileTree() {
    const allPaths = Object.keys(files);

    if (allPaths.length === 0 && folders.size === 0) {
        if (emptyFiles) emptyFiles.style.display = 'flex';
        if (fileTree) fileTree.innerHTML = '';
        return;
    }

    if (emptyFiles) emptyFiles.style.display = 'none';
    if (!fileTree) return;

    fileTree.innerHTML = '';

    const tree = {};

    allPaths.forEach(path => {
        const parts = path.split('/');
        let current = tree;
        parts.forEach((part, i) => {
            if (i === parts.length - 1) {
                current[part] = { __isFile: true, __path: path };
            } else {
                if (!current[part]) {
                    current[part] = { __isFolder: true, __path: parts.slice(0, i + 1).join('/') };
                }
                current = current[part];
            }
        });
    });

    renderTreeLevel(tree, fileTree, 0);
}

function renderTreeLevel(node, container, level) {
    const entries = Object.entries(node).filter(([key]) => !key.startsWith('__'));

    entries.sort((a, b) => {
        const aIsFolder = a[1].__isFolder;
        const bIsFolder = b[1].__isFolder;
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        return a[0].localeCompare(b[0]);
    });

    entries.forEach(([name, data]) => {
        if (data.__isFile) {
            const ext = name.split('.').pop().toLowerCase();
            const item = document.createElement('div');
            item.className = 'tree-item';
            if (data.__path === currentFile) item.classList.add('active');
            item.style.paddingLeft = (12 + level * 14) + 'px';

            let icon = 'fa-solid fa-file';
            let iconColor = '';
            if (ext === 'html') { icon = 'fa-brands fa-html5'; iconColor = 'color:#e34c26'; }
            else if (ext === 'css') { icon = 'fa-brands fa-css3-alt'; iconColor = 'color:#264de4'; }
            else if (ext === 'js') { icon = 'fa-brands fa-js'; iconColor = 'color:#f7df1e'; }
            else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) { icon = 'fa-solid fa-image'; iconColor = 'color:#a855f7'; }
            else if (ext === 'json') { icon = 'fa-solid fa-file-code'; iconColor = 'color:#f59e0b'; }
            else if (ext === 'md') { icon = 'fa-solid fa-file-lines'; iconColor = 'color:#6366f1'; }
            else if (ext === 'sql') { icon = 'fa-solid fa-database'; iconColor = 'color:#10b981'; }

            item.innerHTML = `<i class="${icon}" style="${iconColor}"></i><span>${name}</span>`;
            item.onclick = () => selectFile(data.__path);
            container.appendChild(item);
        } else if (data.__isFolder) {
            const isExpanded = expandedFolders.has(data.__path);

            const item = document.createElement('div');
            item.className = 'tree-item folder';
            item.style.paddingLeft = (12 + level * 14) + 'px';

            item.innerHTML = `
                <i class="fa-solid ${isExpanded ? 'fa-folder-open' : 'fa-folder'}"></i>
                <span>${name}</span>
            `;

            item.onclick = () => {
                if (expandedFolders.has(data.__path)) {
                    expandedFolders.delete(data.__path);
                } else {
                    expandedFolders.add(data.__path);
                }
                renderFileTree();
            };

            container.appendChild(item);

            if (isExpanded) {
                const childContainer = document.createElement('div');
                container.appendChild(childContainer);
                renderTreeLevel(data, childContainer, level + 1);
            }
        }
    });
}

function selectFile(path) {
    currentFile = path;
    if (editorPlaceholder) editorPlaceholder.style.display = 'none';
    if (codeEditor) {
        codeEditor.style.display = 'block';
        codeEditor.value = files[path] || '';
    }
    if (filePathDisplay) filePathDisplay.textContent = path;

    if (currentView === 'preview') switchView('code');
    renderFileTree();
}

function onEditorChange() {
    if (currentFile && codeEditor) {
        files[currentFile] = codeEditor.value;
        if (projects[currentProjectId]) {
            projects[currentProjectId].files = files;
            saveProjects();
        }
    }
}

// ============= VIEW SWITCHING =============
function switchView(view) {
    currentView = view;
    if (codeTab) codeTab.classList.toggle('active', view === 'code');
    if (previewTab) previewTab.classList.toggle('active', view === 'preview');

    if (currentMode === 'plan' && currentPlan) {
        showPlanView();
        return;
    }

    if (view === 'code') {
        if (editorView) editorView.style.display = 'flex';
        if (previewView) previewView.style.display = 'none';
        if (planView) planView.style.display = 'none';
    } else {
        if (editorView) editorView.style.display = 'none';
        if (previewView) previewView.style.display = 'flex';
        if (planView) planView.style.display = 'none';
        updatePreview();
    }
}

function updatePreview() {
    if (!previewIframe) return;

    const allFiles = Object.keys(files);
    let htmlFile = allFiles.find(f => f === 'index.html' || f.endsWith('/index.html'));
    if (!htmlFile) htmlFile = allFiles.find(f => f.endsWith('.html'));

    if (!htmlFile) {
        previewIframe.srcdoc = `
            <html>
            <body style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0e0e16;color:#55556a;font-family:Inter,sans-serif;">
                <div style="text-align:center;">
                    <div style="font-size:48px;margin-bottom:16px;">📄</div>
                    <p>No HTML file found</p>
                    <p style="font-size:0.8rem;margin-top:8px;color:#333;">Ask the AI to create one!</p>
                </div>
            </body>
            </html>
        `;
        return;
    }

    let html = files[htmlFile];

    // Remove local CSS/JS references
    html = html.replace(/<link[^>]*href=["'](?!http)[^"']*\.css["'][^>]*>/gi, '');
    html = html.replace(/<script[^>]*src=["'](?!http)[^"']*\.js["'][^>]*><\/script>/gi, '');

    // Inject CSS
    const cssFiles = allFiles.filter(f => f.endsWith('.css'));
    let allCSS = cssFiles.map(f => `/* ${f} */\n${files[f]}`).join('\n\n');

    // Inject JS
    const jsFiles = allFiles.filter(f => f.endsWith('.js'));
    let allJS = jsFiles.map(f => `/* ${f} */\n${files[f]}`).join('\n\n');

    if (allCSS) {
        const styleTag = `<style>\n${allCSS}\n</style>`;
        html = html.includes('</head>') ? html.replace('</head>', `${styleTag}\n</head>`) : styleTag + '\n' + html;
    }

    if (allJS) {
        const scriptTag = `<script>\n${allJS}\n<\/script>`;
        html = html.includes('</body>') ? html.replace('</body>', `${scriptTag}\n</body>`) : html + '\n' + scriptTag;
    }

    previewIframe.srcdoc = html;
}

// ============= KEYBOARD SHORTCUTS =============
function onGlobalKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (currentProjectId && projects[currentProjectId]) {
            projects[currentProjectId].files = files;
            saveProjects();
        }
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
    }

    if (e.key === 'Escape') {
        hideModal();
        closeQuestionnaire();
        closeSupabaseSettings();
        closeSettings();
        closeSearch();
    }
}

// Run init if DOM is already loaded
if (document.readyState !== 'loading') {
    init();
}
