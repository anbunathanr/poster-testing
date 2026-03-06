// Configuration
const API_BASE_URL = 'http://localhost:3000'; // Change this to your API URL

// State
let authToken = localStorage.getItem('authToken');
let userEmail = localStorage.getItem('userEmail');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        showApp();
    } else {
        showAuth();
    }

    // Setup form handlers
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('generate-form').addEventListener('submit', handleGenerateTest);
    document.getElementById('execute-form').addEventListener('submit', handleExecuteTest);
});

// Tab switching
function showTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabs = document.querySelectorAll('.tab');

    tabs.forEach(t => t.classList.remove('active'));

    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        tabs[1].classList.add('active');
    }

    clearMessage('auth-message');
}

// Authentication handlers
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        showMessage('auth-message', 'Logging in...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            userEmail = email;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('userEmail', userEmail);
            
            showMessage('auth-message', 'Login successful!', 'success');
            setTimeout(showApp, 1000);
        } else {
            showMessage('auth-message', data.message || 'Login failed', 'error');
        }
    } catch (error) {
        showMessage('auth-message', `Error: ${error.message}`, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const tenantId = document.getElementById('register-tenant').value;

    try {
        showMessage('auth-message', 'Registering...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, tenantId })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('auth-message', 'Registration successful! Please login.', 'success');
            setTimeout(() => showTab('login'), 2000);
        } else {
            showMessage('auth-message', data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        showMessage('auth-message', `Error: ${error.message}`, 'error');
    }
}

function logout() {
    authToken = null;
    userEmail = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    showAuth();
}

// Test generation handler
async function handleGenerateTest(e) {
    e.preventDefault();
    
    const prompt = document.getElementById('test-prompt').value;
    const environment = document.getElementById('test-environment').value;

    try {
        showMessage('generate-message', 'Generating test...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/tests/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ prompt, environment })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('generate-message', 'Test generated successfully!', 'success');
            displayGeneratedTest(data);
        } else {
            showMessage('generate-message', data.message || 'Test generation failed', 'error');
        }
    } catch (error) {
        showMessage('generate-message', `Error: ${error.message}`, 'error');
    }
}

// Test execution handler
async function handleExecuteTest(e) {
    e.preventDefault();
    
    const testId = document.getElementById('execute-test-id').value;

    try {
        showMessage('execute-message', 'Executing test...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/tests/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ testId })
        });

        const data = await response.json();

        if (response.ok) {
            const status = data.status === 'PASS' ? 'success' : 'error';
            showMessage('execute-message', `Test execution completed: ${data.status}`, status);
            displayExecutionResult(data);
        } else {
            showMessage('execute-message', data.message || 'Test execution failed', 'error');
        }
    } catch (error) {
        showMessage('execute-message', `Error: ${error.message}`, 'error');
    }
}

// Load test results
async function loadTestResults() {
    try {
        const response = await fetch(`${API_BASE_URL}/tests/results`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            displayTestResults(data.results || []);
        } else {
            showMessage('execute-message', 'Failed to load results', 'error');
        }
    } catch (error) {
        showMessage('execute-message', `Error: ${error.message}`, 'error');
    }
}

// Display functions
function displayGeneratedTest(data) {
    const container = document.getElementById('generated-test');
    container.innerHTML = `
        <h3>Generated Test</h3>
        <p><strong>Test ID:</strong> ${data.testId}</p>
        <p><strong>Environment:</strong> ${data.environment}</p>
        <pre>${JSON.stringify(data.testScript, null, 2)}</pre>
        <button onclick="document.getElementById('execute-test-id').value='${data.testId}'" class="btn-secondary">
            Use this Test ID
        </button>
    `;
    container.classList.add('show');
}

function displayExecutionResult(data) {
    const container = document.getElementById('execution-result');
    container.innerHTML = `
        <h3>Execution Result</h3>
        <p><strong>Status:</strong> <span class="status-badge ${data.status.toLowerCase()}">${data.status}</span></p>
        <p><strong>Duration:</strong> ${data.duration}ms</p>
        <p><strong>Result ID:</strong> ${data.resultId}</p>
        ${data.error ? `<p><strong>Error:</strong> ${data.error}</p>` : ''}
        ${data.screenshotUrl ? `<p><a href="${data.screenshotUrl}" target="_blank">View Screenshot</a></p>` : ''}
    `;
    container.classList.add('show');
    
    // Refresh results list
    loadTestResults();
}

function displayTestResults(results) {
    const container = document.getElementById('results-list');
    
    if (results.length === 0) {
        container.innerHTML = '<p style="color: #666;">No test results yet. Generate and execute a test to see results here.</p>';
        return;
    }

    container.innerHTML = results.map(result => `
        <div class="result-item ${result.status.toLowerCase()}">
            <h4>${result.testName || 'Test'}</h4>
            <p><span class="status-badge ${result.status.toLowerCase()}">${result.status}</span></p>
            <p><strong>Executed:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
            <p><strong>Duration:</strong> ${result.duration}ms</p>
            ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
        </div>
    `).join('');
}

// UI helpers
function showAuth() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('app-section').style.display = 'none';
    document.getElementById('user-info').style.display = 'none';
}

function showApp() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'block';
    document.getElementById('user-info').style.display = 'flex';
    document.getElementById('user-email').textContent = userEmail;
    
    // Load initial data
    loadTestResults();
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `message ${type}`;
}

function clearMessage(elementId) {
    const element = document.getElementById(elementId);
    element.className = 'message';
    element.textContent = '';
}
