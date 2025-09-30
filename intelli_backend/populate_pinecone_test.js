const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Documentos de prueba sobre contabilidad pública
const testDocuments = [
    {
        id: 'doc-mc-rc-001',
        content: `Los documentos contables del Presupuesto de Gastos incluyen:

MC (Mandato de Compromiso): Se utiliza para comprometer crédito presupuestario. Autoriza la realización de un gasto específico.

RC (Reconocimiento de la Obligación): Se utiliza para reconocer una obligación de pago. Variantes incluyen:
- RC-102: Para gastos de personal
- RC-103: Para gastos corrientes en bienes y servicios
- RC-104: Para inversiones reales

A (Autorización): Documento que autoriza el pago de una obligación reconocida.

D (Disposición): Ordena el pago efectivo de la obligación.

AD (Autorización-Disposición): Combina autorización y disposición en un solo documento.

OK (Orden de Pago): Documento que ordena el pago al Tesoro.

ADOK (Autorización-Disposición-Orden de Pago): Combina todos los procesos en un documento.

O (Orden): Documento complementario para operaciones específicas.

K (Confirmación): Confirma la realización de operaciones presupuestarias.

Anexos: Documentos complementarios que acompañan a los principales con información detallada.`,
        metadata: {
            title: 'Documentos Contables del Presupuesto de Gastos',
            category: 'contabilidad',
            source: 'manual_presupuestario',
            type: 'documento_contable'
        }
    },
    {
        id: 'doc-autorizacion-001',
        content: `Según la Orden de 1 de febrero de 1996, la autorización de documentos contables se establece de la siguiente manera:

MC (Mandato de Compromiso): Debe ser autorizado por el órgano gestor competente, generalmente el jefe de servicio o director del área correspondiente.

RC-102 (Reconocimiento de Obligación - Personal): Requiere autorización del responsable de recursos humanos y del interventor.

OK (Orden de Pago): Debe ser autorizada por el ordenador de pagos designado.

PR (Propuesta de Pago): Requiere autorización del órgano proponente y validación del interventor.

La firma electrónica se realiza mediante certificados digitales reconocidos, utilizando el formato XAdES (XML Advanced Electronic Signatures) que garantiza:
- Autenticidad del firmante
- Integridad del documento
- No repudio de la firma
- Validez temporal de la firma

El proceso de firma electrónica debe seguir los estándares establecidos por la Ley 59/2003 de firma electrónica y sus desarrollos reglamentarios.`,
        metadata: {
            title: 'Autorización y Firma Electrónica de Documentos Contables',
            category: 'autorizacion',
            source: 'orden_1996_febrero',
            type: 'normativa'
        }
    },
    {
        id: 'doc-ambito-orden-001',
        content: `La Orden de 1 de febrero de 1996 establece el ámbito de aplicación y requisitos para documentos electrónicos:

ÁMBITO DE APLICACIÓN:
- Administración General del Estado
- Organismos autónomos
- Entidades gestoras de la Seguridad Social
- Servicios comunes de las Comunidades Autónomas (cuando aplique)

EXIGENCIAS SOBRE DOCUMENTOS ELECTRÓNICOS:
1. Uso obligatorio de documentos electrónicos para:
   - Todos los procedimientos de gestión presupuestaria
   - Tramitación de expedientes de gasto
   - Procesos de control interno

2. Formato de firma electrónica XAdES:
   - XAdES-BES: Firma básica con certificado
   - XAdES-T: Incluye sello de tiempo
   - XAdES-C: Incluye referencias de validación
   - XAdES-A: Archivo a largo plazo

3. Requisitos técnicos:
   - Certificados cualificados según normativa europea
   - Algoritmos de hash SHA-256 o superior
   - Validación en tiempo real de certificados
   - Archivo seguro de documentos firmados

La implementación debe garantizar la interoperabilidad entre sistemas y el cumplimiento de estándares internacionales.`,
        metadata: {
            title: 'Ámbito de Aplicación Orden 1 febrero 1996',
            category: 'normativa',
            source: 'orden_1996_febrero',
            type: 'ambito_aplicacion'
        }
    },
    {
        id: 'doc-ley47-principios-001',
        content: `La Ley 47/2003, de 26 de noviembre, General Presupuestaria, establece los principios rectores de la programación y gestión presupuestaria:

PRINCIPIOS RECTORES:

1. ESTABILIDAD PRESUPUESTARIA:
   - Equilibrio entre ingresos y gastos públicos
   - Sostenibilidad de las finanzas públicas a medio y largo plazo
   - Cumplimiento de los objetivos de déficit establecidos

2. PLURIANUALIDAD:
   - Programación presupuestaria a medio plazo (3-4 años)
   - Coherencia entre ejercicios presupuestarios
   - Previsión de efectos futuros de las decisiones actuales

3. TRANSPARENCIA:
   - Información clara y accesible sobre el presupuesto
   - Publicidad de los procedimientos presupuestarios
   - Rendición de cuentas ante los ciudadanos

4. EFICIENCIA:
   - Optimización en el uso de recursos públicos
   - Evaluación de resultados y rendimiento
   - Mejora continua en la gestión

ESCENARIOS PRESUPUESTARIOS PLURIANUALES:
Los escenarios se articulan mediante:
- Marco presupuestario a medio plazo
- Objetivos de estabilidad presupuestaria
- Límites de gasto no financiero
- Regla de gasto que vincula el crecimiento del gasto con el PIB potencial

Estos escenarios deben ser coherentes con:
- Programa de Estabilidad enviado a la UE
- Objetivos macroeconómicos del Gobierno
- Sostenibilidad de la deuda pública`,
        metadata: {
            title: 'Principios Rectores Ley 47/2003',
            category: 'principios',
            source: 'ley_47_2003',
            type: 'principios_presupuestarios'
        }
    },
    {
        id: 'doc-sector-publico-001',
        content: `Según la Ley 47/2003, las entidades que integran el sector público estatal se clasifican en los siguientes subsectores:

SUBSECTOR ADMINISTRATIVO:
- Administración General del Estado
- Organismos autónomos (O.A.)
- Entidades gestoras de la Seguridad Social
- Servicios comunes de las Comunidades Autónomas
- Universidades públicas
- Otros organismos de derecho público

SUBSECTOR EMPRESARIAL:
- Entidades públicas empresariales (E.P.E.)
- Sociedades mercantiles estatales
- Entidades de derecho público con actividad empresarial
- Consorcios con participación mayoritaria estatal
- Empresas participadas por el sector público

SUBSECTOR FUNDACIONAL:
- Fundaciones del sector público estatal
- Fundaciones constituidas con participación mayoritaria del Estado
- Fundaciones que reciban subvenciones superiores al 50% de sus ingresos
- Otras entidades sin ánimo de lucro controladas por el sector público

CRITERIOS DE CLASIFICACIÓN:
- Control público: Capacidad de determinar políticas generales
- Financiación pública: Dependencia de recursos públicos
- Naturaleza jurídica: Forma de constitución y régimen aplicable
- Actividad desarrollada: Administrativa, empresarial o fundacional

Esta clasificación determina:
- Régimen presupuestario aplicable
- Sistemas de control y fiscalización
- Normas contables específicas
- Procedimientos de rendición de cuentas`,
        metadata: {
            title: 'Clasificación Sector Público Estatal Ley 47/2003',
            category: 'sector_publico',
            source: 'ley_47_2003',
            type: 'clasificacion_entidades'
        }
    }
];

async function populatePinecone() {
    console.log('🚀 Poblando Pinecone con documentos de prueba...\n');
    
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!pineconeApiKey || !openaiApiKey) {
        console.error('❌ Faltan API keys necesarias');
        return;
    }
    
    try {
        // 1. Obtener información del índice
        const indexResponse = await fetch('https://api.pinecone.io/indexes', {
            method: 'GET',
            headers: {
                'Api-Key': pineconeApiKey,
                'Content-Type': 'application/json'
            }
        });

        const indexes = await indexResponse.json();
        const targetIndex = indexes.indexes?.find(idx => idx.name === 'docs-pinecone');
        
        if (!targetIndex) {
            console.error('❌ Índice "docs-pinecone" no encontrado');
            return;
        }
        
        console.log('✅ Índice encontrado:', targetIndex.name);
        
        // 2. Generar embeddings y subir documentos
        const vectors = [];
        
        for (let i = 0; i < testDocuments.length; i++) {
            const doc = testDocuments[i];
            console.log(`📄 Procesando documento ${i + 1}/${testDocuments.length}: ${doc.metadata.title}`);
            
            // Generar embedding
            const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: doc.content
                })
            });

            if (!embeddingResponse.ok) {
                console.error(`❌ Error generando embedding para ${doc.id}`);
                continue;
            }

            const embeddingData = await embeddingResponse.json();
            const embedding = embeddingData.data[0].embedding;
            
            vectors.push({
                id: doc.id,
                values: embedding,
                metadata: {
                    ...doc.metadata,
                    content: doc.content
                }
            });
            
            console.log(`✅ Embedding generado para ${doc.id}`);
        }
        
        // 3. Subir vectores a Pinecone
        console.log('\n📤 Subiendo vectores a Pinecone...');
        
        const upsertResponse = await fetch(`https://${targetIndex.host}/vectors/upsert`, {
            method: 'POST',
            headers: {
                'Api-Key': pineconeApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                vectors: vectors
            })
        });

        if (!upsertResponse.ok) {
            const errorText = await upsertResponse.text();
            throw new Error(`Error subiendo vectores: ${upsertResponse.status} - ${errorText}`);
        }

        const upsertData = await upsertResponse.json();
        console.log('✅ Vectores subidos exitosamente:', upsertData.upsertedCount);
        
        // 4. Verificar que se subieron correctamente
        console.log('\n🔍 Verificando contenido...');
        
        const statsResponse = await fetch(`https://${targetIndex.host}/describe_index_stats`, {
            method: 'POST',
            headers: {
                'Api-Key': pineconeApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            console.log('📊 Total de vectores en el índice:', stats.totalVectorCount);
        }
        
        console.log('\n✅ Población completada exitosamente!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Ejecutar población
populatePinecone();