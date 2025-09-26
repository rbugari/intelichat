const fs = require('fs');
const path = require('path');

function getPrompt(language = 'es', agentName) {
    const basePath = path.join(__dirname, 'prompts', language);
    const commonPath = path.join(basePath, 'common.md');
    const agentPath = path.join(basePath, `${agentName}.md`);

    try {
        const commonContent = fs.readFileSync(commonPath, 'utf8');
        const agentContent = fs.readFileSync(agentPath, 'utf8');

        return `${commonContent}\n\n${agentContent}`;
    } catch (error) {
        console.error(`Error al cargar el prompt para ${agentName} en ${language}:`, error);
        // Fallback to a generic error prompt or handle as needed
        return `Error: No se pudo cargar el prompt para el agente ${agentName}.`;
    }
}

// This function is kept for compatibility with the existing CLI structure
function getPromptByAgent(agent, language = 'es') {
    switch (agent) {
        case 'info':
            return getPrompt(language, 'info');
        case 'onboarding':
            return getPrompt(language, 'onboarding');
        case 'clientes':
            return getPrompt(language, 'clientes');
        default:
            return getPrompt(language, 'info'); // Default to info agent
    }
}

module.exports = {
    getPromptByAgent
};
