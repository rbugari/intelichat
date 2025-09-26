const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testFileUpload() {
  try {
    // Primero crear una nueva ejecución
    console.log('Creando nueva ejecución...');
    const execResponse = await fetch('http://localhost:3000/api/forms/1/executions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const execData = await execResponse.json();
    console.log('Ejecución creada:', execData);
    
    if (!execData.success) {
      console.error('Error al crear ejecución:', execData.error);
      return;
    }
    
    const uuid = execData.data.execution_uuid;
    
    // Ahora probar subida de archivo
    console.log('\nProbando subida de archivo...');
    const form = new FormData();
    form.append('campo', 'documento');
    form.append('file', fs.createReadStream('test-file.txt'), 'test-file.txt');
    
    const uploadResponse = await fetch(`http://localhost:3000/api/forms/executions/${uuid}/files`, {
      method: 'POST',
      body: form
    });
    
    const uploadData = await uploadResponse.json();
    console.log('Resultado subida:', uploadData);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFileUpload();