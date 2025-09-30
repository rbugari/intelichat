const path = require('path');
const axios = require('axios');

// Cargar variables de entorno
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuración del servidor
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const API_BASE = `${SERVER_URL}/api`;

// Configuración de prueba - Usando el agente RAG configurado
const TEST_CONFIG = {
    cliente_id: 4,
    chatbot_id: 100, // RAG Test Bot
    timeout: 30000 // 30 segundos timeout
};

// Preguntas de prueba variadas
const TEST_QUESTIONS = [
    "Hola, ¿cómo estás?",
    "¿Qué servicios ofrecen?",
    "Necesito información sobre documentación pendiente",
    "¿Cómo puedo registrarme como transportista?",
    "¿Cuáles son los requisitos para el onboarding?"
];

class ChatTester {
    constructor() {
        this.sessionId = null;
        this.results = [];
        this.startTime = Date.now();
    }

    async log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            'info': '📝',
            'success': '✅',
            'error': '❌',
            'warning': '⚠️'
        }[type] || '📝';
        
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async testConnection() {
        await this.log('🔍 Probando conexión al servidor...', 'info');
        
        try {
            const response = await axios.get(`${API_BASE}/chat/agent-info`, {
                params: {
                    cliente_id: TEST_CONFIG.cliente_id,
                    chatbot_id: TEST_CONFIG.chatbot_id
                },
                timeout: TEST_CONFIG.timeout
            });

            if (response.data.status === 'success') {
                await this.log(`Conexión exitosa - Agente: ${response.data.agent.nombre}`, 'success');
                await this.log(`LLM: ${response.data.llm.provider}/${response.data.llm.model}`, 'info');
                return true;
            } else {
                await this.log(`Error en respuesta: ${response.data.error}`, 'error');
                return false;
            }
        } catch (error) {
            await this.log(`Error de conexión: ${error.message}`, 'error');
            return false;
        }
    }

    async sendMessage(message, isInitial = false) {
        const payload = {
            cliente_id: TEST_CONFIG.cliente_id,
            chatbot_id: TEST_CONFIG.chatbot_id,
            [isInitial ? 'initial_message' : 'message']: message
        };

        if (this.sessionId && !isInitial) {
            payload.sessionId = this.sessionId;
        }

        try {
            const response = await axios.post(`${API_BASE}/chat`, payload, {
                timeout: TEST_CONFIG.timeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            throw new Error(`HTTP ${error.response?.status}: ${error.response?.data?.error || error.message}`);
        }
    }

    async testQuestion(question, questionIndex) {
        const isInitial = questionIndex === 0;
        const testNumber = questionIndex + 1;
        
        await this.log(`\n🧪 PRUEBA ${testNumber}/${TEST_QUESTIONS.length}`, 'info');
        await this.log(`Pregunta: "${question}"`, 'info');
        
        const startTime = Date.now();
        
        try {
            const response = await this.sendMessage(question, isInitial);
            const responseTime = Date.now() - startTime;
            
            // Guardar sessionId si es la primera pregunta
            if (isInitial && response.sessionId) {
                this.sessionId = response.sessionId;
                await this.log(`SessionId obtenido: ${this.sessionId}`, 'success');
            }

            // Validar respuesta
            if (response.status === 'success') {
                await this.log(`Respuesta recibida en ${responseTime}ms`, 'success');
                
                // Mostrar información del agente
                if (response.agent) {
                    await this.log(`Agente activo: ${response.agent.nombre} (ID: ${response.agent.id})`, 'info');
                }

                // Mostrar respuestas del bot
                if (response.response && response.response.length > 0) {
                    response.response.forEach((msg, idx) => {
                        console.log(`   💬 ${msg.agent.nombre}: ${msg.text}`);
                    });
                } else {
                    await this.log('⚠️ No se recibieron mensajes en la respuesta', 'warning');
                }

                // Guardar resultado
                this.results.push({
                    question,
                    success: true,
                    responseTime,
                    agentId: response.agent?.id,
                    agentName: response.agent?.nombre,
                    messageCount: response.response?.length || 0,
                    sessionId: response.sessionId
                });

                return true;
            } else {
                await this.log(`Error en respuesta: ${response.error}`, 'error');
                this.results.push({
                    question,
                    success: false,
                    error: response.error,
                    responseTime
                });
                return false;
            }
        } catch (error) {
            const responseTime = Date.now() - startTime;
            await this.log(`Error: ${error.message}`, 'error');
            this.results.push({
                question,
                success: false,
                error: error.message,
                responseTime
            });
            return false;
        }
    }

    async runAllTests() {
        await this.log('🚀 INICIANDO PRUEBAS BATCH DEL CHAT', 'info');
        await this.log(`Servidor: ${SERVER_URL}`, 'info');
        await this.log(`Cliente ID: ${TEST_CONFIG.cliente_id}, Chatbot ID: ${TEST_CONFIG.chatbot_id}`, 'info');
        
        // Probar conexión
        const connectionOk = await this.testConnection();
        if (!connectionOk) {
            await this.log('❌ Pruebas canceladas - No se pudo conectar al servidor', 'error');
            return;
        }

        // Ejecutar todas las preguntas
        let successCount = 0;
        for (let i = 0; i < TEST_QUESTIONS.length; i++) {
            const success = await this.testQuestion(TEST_QUESTIONS[i], i);
            if (success) successCount++;
            
            // Pausa entre preguntas
            if (i < TEST_QUESTIONS.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Mostrar resumen
        await this.showSummary(successCount);
    }

    async showSummary(successCount) {
        const totalTime = Date.now() - this.startTime;
        const failCount = TEST_QUESTIONS.length - successCount;
        
        await this.log('\n📊 RESUMEN DE PRUEBAS', 'info');
        console.log('='.repeat(50));
        console.log(`✅ Exitosas: ${successCount}/${TEST_QUESTIONS.length}`);
        console.log(`❌ Fallidas: ${failCount}/${TEST_QUESTIONS.length}`);
        console.log(`⏱️  Tiempo total: ${totalTime}ms`);
        console.log(`🔗 SessionId final: ${this.sessionId || 'N/A'}`);
        
        if (this.results.length > 0) {
            const avgResponseTime = this.results
                .filter(r => r.success)
                .reduce((sum, r) => sum + r.responseTime, 0) / successCount;
            console.log(`⚡ Tiempo promedio de respuesta: ${Math.round(avgResponseTime)}ms`);
        }

        // Mostrar detalles de errores
        const errors = this.results.filter(r => !r.success);
        if (errors.length > 0) {
            await this.log('\n❌ ERRORES ENCONTRADOS:', 'error');
            errors.forEach((error, idx) => {
                console.log(`${idx + 1}. "${error.question}"`);
                console.log(`   Error: ${error.error}`);
            });
        }

        // Verificar agente RAG
        const ragResponses = this.results.filter(r => r.success && r.agentId === 200);
        if (ragResponses.length > 0) {
            await this.log(`\n🤖 AGENTE RAG (ID 200) respondió ${ragResponses.length} veces`, 'success');
        } else {
            await this.log('\n⚠️ El agente RAG (ID 200) no respondió en ninguna prueba', 'warning');
        }

        console.log('='.repeat(50));
        
        const status = successCount === TEST_QUESTIONS.length ? 'success' : 'warning';
        await this.log(`Pruebas completadas: ${successCount}/${TEST_QUESTIONS.length} exitosas`, status);
    }
}

// Función principal
async function main() {
    const tester = new ChatTester();
    
    try {
        await tester.runAllTests();
    } catch (error) {
        console.error('❌ Error fatal en las pruebas:', error.message);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Error no manejado:', error);
        process.exit(1);
    });
}

module.exports = { ChatTester, TEST_QUESTIONS, TEST_CONFIG };