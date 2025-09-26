const colors = {
    info: '\x1b[34m',
    onboarding: '\x1b[32m',
    clientes: '\x1b[35m',
    reset: '\x1b[0m'
};

const agentReportData = [
    { name: 'info', emoji: 'ℹ️', description: 'Responde preguntas y califica el interés.', tools: [] },
    { name: 'onboarding', emoji: '🚀', description: 'Valida y registra nuevos transportistas.', tools: ['findByDotEmail', 'registerCarrier'] },
    { name: 'clientes', emoji: '👤', description: 'Asiste a transportistas ya registrados.', tools: ['pendingDocuments'] }
];

function printStartupReport(activeAgent, language) {
    const isMock = process.env.MOCK_API === 'true';
    const mode = isMock ? 'मॉक (MOCK)' : '🌐 (ON-LINE)';

    console.log("Bot Kargho iniciado.");
    console.log("---------------------------------------------------------------------");
    console.log(`     Idioma: ${language.toUpperCase()}`);
    console.log(` Proveedor LLM: ${process.env.LLM_PROVIDER || 'groq'}`);
    console.log(`    Modelo LLM: ${process.env.LLM_MODEL || 'llama3-70b-8192'}`);
    console.log(`      Modo API: ${mode}\n`);
    console.log(" --- Agentes Disponibles ---");
    agentReportData.forEach(agent => {
        const isActive = agent.name === activeAgent;
        const marker = isActive ? `>> ${colors[agent.name]}` : `   ${colors.reset}`;
        console.log(`${marker}${agent.emoji} ${agent.name.toUpperCase()}${colors.reset} - ${agent.description}`);
        if (agent.tools.length > 0) {
            console.log(`      Tools: ${agent.tools.join(', ')}`);
        }
    });
    console.log("---------------------------------------------------------------------\n");
}

module.exports = {
    printStartupReport,
    agentReportData, // Exported for potential external use if needed
    colors // Exported for potential external use if needed
};
