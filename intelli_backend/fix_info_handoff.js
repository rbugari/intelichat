const Database = require('./src/database');
const fs = require('fs');

async function fixInfoHandoff() {
    try {
        // Inicializar la base de datos
        await Database.initialize();
        
        // Leer el prompt original
        const prompt = fs.readFileSync('../docs/info.md', 'utf8');
        
        // Reemplazar handoff_to: "onboarding" con handoff_to: "kargho-onboarding"
        const fixedPrompt = prompt.replace(/"handoff_to": "onboarding"/g, '"handoff_to": "kargho-onboarding"');
        
        // Actualizar en la base de datos
        await Database.query(
            'UPDATE cfg_agente SET system_prompt_es = ? WHERE nombre = "INFO" AND chatbot_id = 2',
            [fixedPrompt]
        );
        
        console.log('✅ Prompt del agente INFO actualizado con mapeo correcto');
        console.log('🔄 Handoff ahora usa: "handoff_to": "kargho-onboarding"');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixInfoHandoff();