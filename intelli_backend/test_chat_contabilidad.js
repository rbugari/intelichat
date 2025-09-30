const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Preguntas específicas sobre documentos contables
const testQuestions = [
    {
        id: 1,
        question: "¿Qué clases de documentos contables del Presupuesto de Gastos existen (MC, RC y sus variantes, A, D, AD, OK, ADOK, O, K y anexos) y para qué operación se utiliza cada uno?",
        expectedKeywords: ["MC", "RC", "Mandato de Compromiso", "Reconocimiento", "Autorización", "Disposición", "Orden de Pago"]
    },
    {
        id: 2,
        question: "¿Quién debe autorizar cada tipo de documento contable (p. ej., MC, RC-102, OK, PR) y cómo se realiza la firma electrónica según la Orden de 1 de febrero de 1996?",
        expectedKeywords: ["autorización", "órgano gestor", "interventor", "firma electrónica", "XAdES", "certificados digitales"]
    },
    {
        id: 3,
        question: "¿Cuál es el ámbito de aplicación de la Orden de 1 de febrero de 1996 y qué exige sobre el uso obligatorio de documentos electrónicos y el formato de firma (XAdES)?",
        expectedKeywords: ["Administración General del Estado", "documentos electrónicos", "XAdES", "obligatorio", "interoperabilidad"]
    },
    {
        id: 4,
        question: "Según la Ley 47/2003, ¿cuáles son los principios rectores de la programación y gestión presupuestaria (estabilidad, plurianualidad, transparencia y eficiencia) y cómo se articulan los escenarios presupuestarios plurianuales con el objetivo de estabilidad?",
        expectedKeywords: ["estabilidad presupuestaria", "plurianualidad", "transparencia", "eficiencia", "escenarios presupuestarios", "medio plazo"]
    },
    {
        id: 5,
        question: "A efectos de la Ley 47/2003, ¿qué entidades integran el sector público estatal y cómo se clasifican en subsectores (administrativo, empresarial y fundacional)?",
        expectedKeywords: ["sector público estatal", "subsector administrativo", "subsector empresarial", "subsector fundacional", "organismos autónomos"]
    }
];

async function testChatContabilidad() {
    console.log('🧪 Iniciando test de chat con preguntas de contabilidad...\n');
    
    let connection;
    
    try {
        // Conectar a la base de datos
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        
        console.log('✅ Conectado a la base de datos');
        
        const results = [];
        const clientId = 4; // Cliente de prueba
        const chatbotId = 100; // RAG Test Bot
        
        for (let i = 0; i < testQuestions.length; i++) {
            const testCase = testQuestions[i];
            console.log(`\n📝 Test ${testCase.id}/${testQuestions.length}: Pregunta sobre contabilidad`);
            console.log(`❓ Pregunta: ${testCase.question.substring(0, 100)}...`);
            
            try {
                // Crear sesión de chat
                const [sessionResult] = await connection.execute(
                    'INSERT INTO chat_sesion (cliente_id, chatbot_id, usuario_ref, canal) VALUES (?, ?, ?, ?)',
                    [clientId, chatbotId, `test_user_${testCase.id}`, 'api']
                );
                
                const sessionId = sessionResult.insertId;
                console.log(`💬 Sesión de chat creada: ${sessionId}`);
                
                // Insertar mensaje del usuario
                const [userMessageResult] = await connection.execute(
                    'INSERT INTO ejec_mensaje (chat_id, rol, contenido) VALUES (?, ?, ?)',
                    [sessionId, 'user', testCase.question]
                );
                
                console.log(`👤 Mensaje de usuario insertado: ${userMessageResult.insertId}`);
                
                // Simular llamada al bot
                const botResponse = await simulateBotResponse(testCase.question, chatbotId, clientId);
                
                // Insertar respuesta del bot
                const [botMessageResult] = await connection.execute(
                    'INSERT INTO ejec_mensaje (chat_id, rol, contenido) VALUES (?, ?, ?)',
                    [sessionId, 'assistant', botResponse]
                );
                
                console.log(`🤖 Respuesta del bot insertada: ${botMessageResult.insertId}`);
                
                // Evaluar respuesta
                const evaluation = evaluateResponse(botResponse, testCase.expectedKeywords);
                
                console.log(`📊 Evaluación: ${evaluation.score}% - ${evaluation.status}`);
                console.log(`🎯 Palabras clave encontradas: ${evaluation.foundKeywords.join(', ')}`);
                console.log(`📄 Respuesta: ${botResponse.substring(0, 200)}...`);
                
                results.push({
                    testId: testCase.id,
                    question: testCase.question,
                    response: botResponse,
                    evaluation: evaluation,
                    sessionId: sessionId
                });
                
                // Pausa entre tests
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`❌ Error en test ${testCase.id}:`, error.message);
                results.push({
                    testId: testCase.id,
                    question: testCase.question,
                    response: null,
                    evaluation: { score: 0, status: 'ERROR', error: error.message },
                    sessionId: null
                });
            }
        }
        
        // Mostrar resumen final
        console.log('\n' + '='.repeat(80));
        console.log('📊 RESUMEN FINAL DEL TEST');
        console.log('='.repeat(80));
        
        let totalScore = 0;
        let successfulTests = 0;
        
        results.forEach(result => {
            console.log(`\nTest ${result.testId}:`);
            console.log(`  ❓ Pregunta: ${result.question.substring(0, 80)}...`);
            console.log(`  📊 Score: ${result.evaluation.score}%`);
            console.log(`  ✅ Estado: ${result.evaluation.status}`);
            
            if (result.evaluation.score > 0) {
                totalScore += result.evaluation.score;
                successfulTests++;
            }
        });
        
        const averageScore = successfulTests > 0 ? (totalScore / successfulTests).toFixed(1) : 0;
        
        console.log(`\n🎯 RESULTADOS GENERALES:`);
        console.log(`   Tests ejecutados: ${results.length}`);
        console.log(`   Tests exitosos: ${successfulTests}`);
        console.log(`   Score promedio: ${averageScore}%`);
        console.log(`   Estado general: ${averageScore >= 70 ? '✅ APROBADO' : '❌ NECESITA MEJORAS'}`);
        
        return results;
        
    } catch (error) {
        console.error('❌ Error general en el test:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexión a BD cerrada');
        }
    }
}

async function simulateBotResponse(question, chatbotId, clientId) {
    try {
        // Simular llamada HTTP al endpoint del bot
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: question,
                chatbot_id: chatbotId,
                cliente_id: clientId,
                sessionId: null // Nueva sesión
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.response || 'Sin respuesta del servidor';
        
    } catch (error) {
        console.error('Error simulando respuesta del bot:', error);
        return `Error: ${error.message}`;
    }
}

function evaluateResponse(response, expectedKeywords) {
    if (!response || response.includes('Error:') || response.includes('Hubo un problema')) {
        return {
            score: 0,
            status: 'FALLO',
            foundKeywords: [],
            missingKeywords: expectedKeywords
        };
    }
    
    const responseText = response.toLowerCase();
    const foundKeywords = [];
    const missingKeywords = [];
    
    expectedKeywords.forEach(keyword => {
        if (responseText.includes(keyword.toLowerCase())) {
            foundKeywords.push(keyword);
        } else {
            missingKeywords.push(keyword);
        }
    });
    
    const score = Math.round((foundKeywords.length / expectedKeywords.length) * 100);
    
    let status;
    if (score >= 80) status = 'EXCELENTE';
    else if (score >= 60) status = 'BUENO';
    else if (score >= 40) status = 'REGULAR';
    else status = 'DEFICIENTE';
    
    return {
        score,
        status,
        foundKeywords,
        missingKeywords
    };
}

// Ejecutar test
if (require.main === module) {
    testChatContabilidad()
        .then(results => {
            console.log('\n✅ Test completado exitosamente');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Test falló:', error);
            process.exit(1);
        });
}

module.exports = { testChatContabilidad };