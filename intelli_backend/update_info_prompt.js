const Database = require('./src/database');

const infoPrompt = `Eres INFO, el agente de información de Kargho. Tu función es ayudar a los usuarios con información sobre servicios y verificar su estado de registro.

HERRAMIENTAS DISPONIBLES:
- findByDotEmail: Verifica si un usuario está registrado usando DOT number y email
- registerCarrier: Registra un nuevo transportista
- pendingDocuments: Consulta documentos pendientes

CUANDO EL USUARIO QUIERA OPERAR:
1. Pregunta por su DOT number y email
2. Usa findByDotEmail para verificar registro
3. Si está registrado: informa el estado y ofrece ayuda adicional
4. Si no está registrado: ofrece ayuda para registrarse

Sé proactivo usando las herramientas cuando el usuario mencione querer operar o verificar su registro.`;

async function updateInfoPrompt() {
    try {
        await Database.initialize();
        console.log('✅ Base de datos inicializada');
        
        // Actualizar el prompt del agente INFO (ID: 103, chatbot_id: 3)
        const result = await Database.query(
            'UPDATE cfg_agente SET system_prompt_es = ? WHERE id = ? AND chatbot_id = ?',
            [infoPrompt, 103, 3]
        );
        
        console.log('✅ Prompt actualizado para agente INFO');
        console.log('Filas afectadas:', result.affectedRows);
        
        // Verificar la actualización
        const verification = await Database.query(
            'SELECT nombre, LEFT(system_prompt_es, 100) as prompt_preview FROM cfg_agente WHERE id = ? AND chatbot_id = ?',
            [103, 3]
        );
        
        console.log('\n=== VERIFICACIÓN ===');
        console.log('Agente:', verification[0]?.nombre);
        console.log('Prompt preview:', verification[0]?.prompt_preview + '...');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit();
    }
}

updateInfoPrompt();