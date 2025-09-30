const fetch = require('node-fetch');

// Test questions for accounting documents
const testQuestions = [
    {
        question: "¿Qué clases de documentos contables del Presupuesto de Gastos existen (MC, RC y sus variantes, A, D, AD, OK, ADOK, O, K y anexos) y para qué operación se utiliza cada uno?",
        expectedKeywords: ["MC", "RC", "mandato", "compromiso", "reconocimiento", "obligación", "A", "D", "AD", "OK", "ADOK", "O", "K", "anexos"]
    },
    {
        question: "¿Quién debe autorizar cada tipo de documento contable (p. ej., MC, RC-102, OK, PR) y cómo se realiza la firma electrónica según la Orden de 1 de febrero de 1996?",
        expectedKeywords: ["autorizar", "MC", "RC-102", "OK", "PR", "firma electrónica", "Orden", "febrero", "1996"]
    },
    {
        question: "¿Cuál es el ámbito de aplicación de la Orden de 1 de febrero de 1996 y qué exige sobre el uso obligatorio de documentos electrónicos y el formato de firma (XAdES)?",
        expectedKeywords: ["ámbito", "aplicación", "Orden", "febrero", "1996", "obligatorio", "documentos electrónicos", "XAdES", "firma"]
    },
    {
        question: "Según la Ley 47/2003, ¿cuáles son los principios rectores de la programación y gestión presupuestaria (estabilidad, plurianualidad, transparencia y eficiencia) y cómo se articulan los escenarios presupuestarios plurianuales con el objetivo de estabilidad?",
        expectedKeywords: ["Ley 47/2003", "principios rectores", "estabilidad", "plurianualidad", "transparencia", "eficiencia", "escenarios presupuestarios", "objetivo"]
    },
    {
        question: "A efectos de la Ley 47/2003, ¿qué entidades integran el sector público estatal y cómo se clasifican en subsectores (administrativo, empresarial y fundacional)?",
        expectedKeywords: ["Ley 47/2003", "entidades", "sector público estatal", "subsectores", "administrativo", "empresarial", "fundacional"]
    }
];

async function testChatSimple() {
    console.log('🚀 Iniciando test simple de chat con Pinecone...\n');
    
    const results = [];
    
    for (let i = 0; i < testQuestions.length; i++) {
        const testCase = testQuestions[i];
        console.log(`📝 Test ${i + 1}/${testQuestions.length}: Pregunta sobre contabilidad`);
        console.log(`❓ Pregunta: ${testCase.question.substring(0, 80)}...`);
        
        try {
            // Llamada directa al API
            const botResponse = await callChatAPI(testCase.question);
            
            // Evaluar respuesta
            const evaluation = evaluateResponse(botResponse, testCase.expectedKeywords);
            
            console.log(`📊 Evaluación: ${evaluation.score}% - ${evaluation.status}`);
            console.log(`🎯 Palabras clave encontradas: ${evaluation.foundKeywords.join(', ')}`);
            console.log(`📄 Respuesta: ${(botResponse || '').toString().substring(0, 100)}...`);
            
            results.push({
                testId: testCase.id,
                question: testCase.question,
                response: botResponse,
                evaluation: evaluation
            });
            
        } catch (error) {
            console.log(`❌ Error en test ${i + 1}: ${error.message}`);
            results.push({
                testId: testCase.id,
                question: testCase.question,
                response: `Error: ${error.message}`,
                evaluation: { score: 0, status: 'ERROR', foundKeywords: [] }
            });
        }
        
        // Pausa entre tests
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('');
    }
    
    // Mostrar resumen final
    showFinalSummary(results);
    
    console.log('✅ Test completado exitosamente');
}

async function callChatAPI(message) {
    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                chatbot_id: 100, // RAG Test Bot
                cliente_id: 4
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('🔍 API Response:', JSON.stringify(data, null, 2));
        
        // Intentar extraer la respuesta del bot
        if (data.response && Array.isArray(data.response) && data.response.length > 0 && data.response[0].text) {
            return data.response[0].text;
        } else if (data.message) {
            return data.message;
        } else {
            return JSON.stringify(data);
        }
    } catch (error) {
        console.error('Error calling chat API:', error);
        return `Error: ${error.message}`;
    }
}

function evaluateResponse(response, expectedKeywords) {
    const responseText = (response || '').toString().toLowerCase();
    const foundKeywords = [];
    
    expectedKeywords.forEach(keyword => {
        if (responseText.includes(keyword.toLowerCase())) {
            foundKeywords.push(keyword);
        }
    });
    
    const score = Math.round((foundKeywords.length / expectedKeywords.length) * 100);
    let status = 'FALLO';
    
    if (score >= 80) status = 'EXCELENTE';
    else if (score >= 60) status = 'BUENO';
    else if (score >= 40) status = 'REGULAR';
    
    return {
        score: score,
        status: status,
        foundKeywords: foundKeywords,
        totalKeywords: expectedKeywords.length
    };
}

function showFinalSummary(results) {
    console.log('================================================================================');
    console.log('📊 RESUMEN FINAL DEL TEST');
    console.log('================================================================================\n');
    
    results.forEach(result => {
        console.log(`Test ${result.testId}:`);
        console.log(`  ❓ Pregunta: ${result.question.substring(0, 80)}...`);
        console.log(`  📊 Score: ${result.evaluation.score}%`);
        console.log(`  ✅ Estado: ${result.evaluation.status}\n`);
    });
    
    const avgScore = Math.round(results.reduce((sum, r) => sum + r.evaluation.score, 0) / results.length);
    const successfulTests = results.filter(r => r.evaluation.score >= 60).length;
    
    let overallStatus = '❌ NECESITA MEJORAS';
    if (avgScore >= 80) overallStatus = '✅ EXCELENTE';
    else if (avgScore >= 60) overallStatus = '✅ BUENO';
    else if (avgScore >= 40) overallStatus = '⚠️ REGULAR';
    
    console.log('🎯 RESULTADOS GENERALES:');
    console.log(`   Tests ejecutados: ${results.length}`);
    console.log(`   Tests exitosos: ${successfulTests}`);
    console.log(`   Score promedio: ${avgScore}%`);
    console.log(`   Estado general: ${overallStatus}\n`);
}

// Ejecutar el test
testChatSimple().catch(console.error);