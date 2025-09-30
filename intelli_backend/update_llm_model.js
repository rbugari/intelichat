const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateLLMModel() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    
    console.log('🔧 Actualizando modelo LLM para agente 200...');
    
    // Buscar un modelo GPT-4 válido
    const query = "SELECT id, nombre_modelo FROM cfg_llm_modelo WHERE nombre_modelo LIKE '%gpt-4%' AND is_active = 1 LIMIT 5";
    const [models] = await connection.execute(query);
    
    if (models.length > 0) {
        console.log('📋 Modelos GPT-4 disponibles:');
        models.forEach(model => {
            console.log('🤖', model.nombre_modelo, '- ID:', model.id);
        });
        
        // Usar el primer modelo disponible (probablemente gpt-4)
        const modelId = models[0].id;
        const modelName = models[0].nombre_modelo;
        
        console.log('🔄 Actualizando agente 200 para usar modelo:', modelName);
        
        const [result] = await connection.execute('UPDATE cfg_agente SET llm_modelo_id = ? WHERE id = 200', [modelId]);
        
        if (result.affectedRows > 0) {
            console.log('✅ Agente 200 actualizado exitosamente');
        } else {
            console.log('❌ No se pudo actualizar el agente 200');
        }
    } else {
        console.log('❌ No se encontraron modelos GPT-4 activos');
    }
    
    await connection.end();
}

updateLLMModel().catch(console.error);