const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5003;

const editorAppPath = __dirname;

// 1. Sirve archivos estáticos (como css, js, etc.) desde la carpeta 'prompt-editor'
app.use(express.static(editorAppPath));

console.log(`Sirviendo archivos estáticos desde: ${editorAppPath}`);

// 2. Para cualquier otra petición que no sea un archivo estático, sirve el index.html
// Esto permite que la app funcione como una Single Page Application (SPA)
app.use((req, res) => {
  res.sendFile(path.join(editorAppPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅ Servidor del Editor de Prompts iniciado.`);
  console.log(`   ==================================================`);
  console.log(`   👉 Abre tu navegador en: http://localhost:${PORT}`);
  console.log(`   ==================================================\n`);
});