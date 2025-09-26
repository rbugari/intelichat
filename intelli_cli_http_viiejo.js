#!/usr/bin/env node

/**
 * Kargho CLI HTTP-Only - Cliente de consola que usa solo HTTP
 * No se conecta directamente a la base de datos
 * Usa las mismas rutas HTTP que el frontend web
 */

require('dotenv').config({ path: './intelli_backend/.env' });

// Import dinámico de node-fetch para compatibilidad
let fetch;

// Función para inicializar fetch
async function initializeFetch() {
  if (!fetch) {
    const { default: nodeFetch } = await import('node-fetch');
    fetch = nodeFetch;
  }
  return fetch;
}

// === CONFIGURACIÓN ===
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const CLIENT_ID = process.env.CLI_CLIENT_ID || '2'; // Cliente por defecto
const CHATBOT_ID = process.env.CLI_CHATBOT_ID || '2'; // Chatbot por defecto

// Códigos de color ANSI
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  orange: '\x1b[38;5;208m',
  purple: '\x1b[38;5;129m',
  pink: '\x1b[38;5;205m'
};

// Mapeo de colores hex a ANSI
const hexToAnsi = {
  '#FF0000': colors.red,
  '#00FF00': colors.green,
  '#0000FF': colors.blue,
  '#FFFF00': colors.yellow,
  '#FF00FF': colors.magenta,
  '#00FFFF': colors.cyan,
  '#FFA500': colors.orange,
  '#800080': colors.purple,
  '#FFC0CB': colors.pink,
  '#FFFFFF': colors.white
};

class KarghoCLI {
  constructor() {
    this.sessionId = null;
    this.currentAgent = 'info';
  }

  // Función para verificar si el backend está disponible
  async checkBackendHealth() {
    try {
      await initializeFetch();
      console.log(`[BACKEND CHECK] Verificando disponibilidad del backend en ${BACKEND_URL}`);
      
      const response = await fetch(`${BACKEND_URL}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[BACKEND STATUS] ✅ Backend disponible - Status: ${data.status}`);
        return { available: true, status: data };
      } else {
        console.log(`[BACKEND STATUS] ❌ Backend responde con error: ${response.status}`);
        return { available: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      console.log(`[BACKEND STATUS] ❌ Backend no disponible: ${error.message}`);
      return { available: false, error: error.message };
    }
  }

  // Obtener información de configuración vía HTTP (si está disponible)
  async getConfigInfo() {
    try {
      await initializeFetch();
      
      // Intentar obtener información de agentes vía API
      const agentsResponse = await fetch(`${BACKEND_URL}/api/agents`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Nota: En producción necesitarías autenticación
        }
      });
      
      if (agentsResponse.ok) {
        const agentsData = await agentsResponse.json();
        return { agents: agentsData.data || [] };
      }
    } catch (error) {
      console.log(`[CONFIG INFO] No se pudo obtener configuración vía API: ${error.message}`);
    }
    
    return { agents: [] };
  }

  getColorCode(colorHex) {
    if (!colorHex) return colors.white;
    return hexToAnsi[colorHex.toUpperCase()] || colors.white;
  }

  colorText(text, colorHex) {
    const colorCode = this.getColorCode(colorHex);
    return `${colorCode}${text}${colors.reset}`;
  }

  // Función para mostrar llamadas a herramientas del backend
  displayToolCalls(toolCalls) {
    if (!toolCalls || toolCalls.length === 0) return;
    
    console.log(`\n\x1b[42m\x1b[30m[REAL SYSTEM]\x1b[0m \x1b[32m[TOOL CALLS]\x1b[0m Herramientas ejecutadas por el backend:`);
    
    toolCalls.forEach((toolCall, index) => {
      console.log(`\n  ${index + 1}. \x1b[33m${toolCall.tool}\x1b[0m`);
      console.log(`     \x1b[36m[PARAMS]\x1b[0m ${JSON.stringify(toolCall.params, null, 6)}`);
      console.log(`     \x1b[32m[RESULT]\x1b[0m ${JSON.stringify(toolCall.result, null, 6)}`);
      
      // Mostrar información específica según el tipo de herramienta
      if (toolCall.tool === 'verify_dot' && toolCall.result) {
        console.log(`     \x1b[36m[DOT INFO]\x1b[0m Válido: ${toolCall.result.valid ? '✅' : '❌'}, Empresa: ${toolCall.result.company_name || 'N/A'}`);
      } else if (toolCall.tool === 'validate_email' && toolCall.result) {
        console.log(`     \x1b[35m[EMAIL INFO]\x1b[0m Válido: ${toolCall.result.valid ? '✅' : '❌'}, Dominio: ${toolCall.result.domain_valid ? '✅' : '❌'}`);
      } else if (toolCall.tool === 'create_user' && toolCall.result) {
        console.log(`     \x1b[32m[USER INFO]\x1b[0m ID: ${toolCall.result.user_id || 'N/A'}, Estado: ${toolCall.result.status || 'N/A'}`);
      }
    });
  }

  async sendMessage(message, agentId = 'info') {
    try {
      await initializeFetch();
      
      // Generar sessionId si no existe
      if (!this.sessionId) {
        this.sessionId = 'cli-session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      }
      
      console.log(`[HTTP REQUEST] Enviando mensaje al backend: ${BACKEND_URL}/chat`);
      console.log(`[REQUEST BODY] message: "${message}", sessionId: ${this.sessionId}, agentId: ${agentId}`);
      
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId: this.sessionId,
          agentId,
          language: 'es',
          clientId: CLIENT_ID,
          chatbotId: CHATBOT_ID
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`[HTTP RESPONSE] Status: ${response.status}`);
      console.log(`[RESPONSE DATA] sessionState: ${JSON.stringify(data.sessionState)}, botResponse length: ${data.botResponse?.length || 0}`);
      
      // Actualizar agente actual si cambió
      if (data.sessionState?.active_agent) {
        this.currentAgent = data.sessionState.active_agent;
      }
      
      return {
        success: true,
        content: data.botResponse,
        agentId: this.currentAgent,
        metadata: data.sessionState
      };
      
    } catch (error) {
      console.error(`[HTTP ERROR] Error enviando mensaje: ${error.message}`);
      return {
        success: false,
        error: error.message,
        content: `Error de conexión: ${error.message}`,
        agentId: 'error'
      };
    }
  }

  async runInteractiveMode() {
    console.log('🚀 Kargho Chat CLI - Modo Interactivo');
    console.log('=' .repeat(50));
    console.log(`📍 Backend: ${BACKEND_URL}`);
    console.log(`👤 Cliente ID: ${CLIENT_ID}, Chatbot ID: ${CHATBOT_ID}`);
    console.log('💡 Escribe "exit" para salir\n');
    
    // Verificar backend
    const backendHealth = await this.checkBackendHealth();
    if (!backendHealth.available) {
      console.error(`\n❌ ERROR: El backend no está disponible`);
      console.error(`   Motivo: ${backendHealth.error}`);
      console.error(`   Asegúrate de que el servidor esté corriendo en ${BACKEND_URL}`);
      return;
    }
    
    // Obtener información de configuración si está disponible
    const configInfo = await this.getConfigInfo();
    if (configInfo.agents.length > 0) {
      console.log('\n🧠 Agentes disponibles:');
      configInfo.agents.forEach(agent => {
        console.log(`   • ${agent.nombre}: ${agent.descripcion || 'Sin descripción'}`);
      });
    }
    
    console.log('\n💬 Iniciando conversación...');
    
    // Modo interactivo simple
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const askQuestion = () => {
      rl.question('👤 Tú: ', async (input) => {
        if (input.toLowerCase() === 'exit') {
          console.log('\n👋 ¡Hasta luego!');
          rl.close();
          return;
        }
        
        if (input.trim() === '') {
          askQuestion();
          return;
        }
        
        const response = await this.sendMessage(input, this.currentAgent);
        
        if (response.success) {
          // Determinar color del agente (por defecto azul)
          const agentColor = '#0000FF'; // Azul por defecto
          const respuestaColoreada = this.colorText(`🤖 Bot (${response.agentId?.toUpperCase() || 'UNKNOWN'}): ${response.content}`, agentColor);
          console.log(respuestaColoreada);
          
          // Mostrar metadata si está disponible
          if (response.metadata) {
            console.log(`📊 Metadata: Mensajes: ${response.metadata.messageCount || 'N/A'}`);
            
            // Mostrar llamadas a herramientas si las hay
            if (response.metadata.toolCalls && response.metadata.toolCalls.length > 0) {
              this.displayToolCalls(response.metadata.toolCalls);
            }
          }
        } else {
          console.error(`❌ Error: ${response.error}`);
        }
        
        console.log(''); // Línea en blanco
        askQuestion();
      });
    };
    
    askQuestion();
  }

  async runTestSequence() {
    console.log('🚀 Kargho Chat CLI - Secuencia de Prueba');
    console.log('=' .repeat(50));
    console.log(`📍 Backend: ${BACKEND_URL}`);
    console.log(`👤 Cliente ID: ${CLIENT_ID}, Chatbot ID: ${CHATBOT_ID}`);
    
    // Verificar backend
    const backendHealth = await this.checkBackendHealth();
    if (!backendHealth.available) {
      console.error(`\n❌ ERROR: El backend no está disponible`);
      console.error(`   Motivo: ${backendHealth.error}`);
      console.error(`   Asegúrate de que el servidor esté corriendo en ${BACKEND_URL}`);
      return;
    }
    
    console.log('\n💬 Ejecutando secuencia de prueba...');
    
    // Mensajes de prueba
    const testMessages = [
      'Hola',
      'español', 
      'quiero saber de kargho',
      'quiero trabajar con kargho',
      'si',
      '12345',
      'test@example.com'
    ];
    
    let messageCount = 0;
    
    for (const message of testMessages) {
      messageCount++;
      
      console.log(`\n--- Mensaje ${messageCount} ---`);
      console.log(`👤 Usuario: ${message}`);
      
      const response = await this.sendMessage(message, this.currentAgent);
      
      if (response.success) {
        // Determinar color del agente (por defecto azul)
        const agentColor = '#0000FF'; // Azul por defecto
        const respuestaColoreada = this.colorText(`🤖 Bot (${response.agentId?.toUpperCase() || 'UNKNOWN'}): ${response.content}`, agentColor);
        console.log(respuestaColoreada);
        
        // Mostrar metadata si está disponible
        if (response.metadata) {
          console.log(`📊 Metadata: Mensajes: ${response.metadata.messageCount || 'N/A'}`);
          
          // Mostrar llamadas a herramientas si las hay
          if (response.metadata.toolCalls && response.metadata.toolCalls.length > 0) {
            this.displayToolCalls(response.metadata.toolCalls);
          }
        }
      } else {
        console.error(`❌ Error: ${response.error}`);
      }
      
      // Pausa entre mensajes
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n📋 SECUENCIA DE PRUEBA COMPLETADA');
    console.log('\n💡 SISTEMA HTTP-ONLY FUNCIONANDO');
    console.log('Este CLI ahora funciona igual que el frontend web:');
    console.log('• Solo usa HTTP para comunicarse con el backend');
    console.log('• No se conecta directamente a la base de datos');
    console.log('• Usa los mismos endpoints que la interfaz web');
    console.log('• Respeta la arquitectura cliente-servidor');
  }

  async run() {
    const args = process.argv.slice(2);
    
    if (args.includes('--interactive') || args.includes('-i')) {
      await this.runInteractiveMode();
    } else {
      await this.runTestSequence();
    }
  }
}

// Ejecutar el CLI
if (require.main === module) {
  const cli = new KarghoCLI();
  cli.run().catch(console.error);
}

module.exports = KarghoCLI;