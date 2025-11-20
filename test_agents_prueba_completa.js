#!/usr/bin/env node
const AbortController = global.AbortController || require('abort-controller')

async function jsonFetch(url, options = {}) {
  const controller = new AbortController()
  const timeoutMs = options.timeout || 90000
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(options.headers||{}) } })
    const text = await res.text()
    try { return { ok: res.ok, status: res.status, data: JSON.parse(text) } } catch { return { ok: res.ok, status: res.status, text } }
  } catch (err) {
    return { ok: false, status: 0, error: err.message }
  } finally { clearTimeout(t) }
}

function now() { return new Date().toISOString() }
function hasRule(prompt) {
  const s = (prompt||'').toLowerCase()
  return s.includes('json') && (s.includes('"say"') || s.includes('say')) && (s.includes('action') || s.includes('"action"'))
}

async function run() {
  console.log('🚀 PRUEBA COMPLETA - %s', now())
  const audit = await jsonFetch('http://localhost:5000/api/audit/agents', { method: 'GET', timeout: 20000 })
  if (!audit.ok) { console.error('❌ Error audit:', audit.status, audit.error || audit.text); process.exit(1) }
  const agentes = audit.data.agentes || []
  const byChatbot = new Map()
  for (const a of agentes) { if (!byChatbot.has(a.chatbot_id)) byChatbot.set(a.chatbot_id, []); byChatbot.get(a.chatbot_id).push(a) }

  const promptChecks = []
  for (const [chatbotId, list] of byChatbot.entries()) {
    const cfg = await jsonFetch(`http://localhost:5000/api/debug/config?chatbot_id=${chatbotId}`, { method: 'GET', timeout: 30000 })
    if (!cfg.ok) { promptChecks.push({ chatbotId, error: cfg.error || cfg.text }); continue }
    const agentesCfg = (cfg.data.agentes_disponibles || [])
    for (const ag of agentesCfg) {
      const okES = hasRule(ag.system_prompt_es)
      const okEN = hasRule(ag.system_prompt_en)
      promptChecks.push({ id: ag.id, nombre: ag.nombre, chatbotId, okES, okEN, lenES: (ag.system_prompt_es||'').length, lenEN: (ag.system_prompt_en||'').length })
    }
  }

  const FULL = process.argv.includes('--full')
  const idsAll = agentes.map(a => a.id)
  const TEST_IDS = FULL ? idsAll : [103,104,107,200]
  const results = []
  const CONC = 3
  let idx = 0
  async function runOne(id){
    const body = JSON.stringify({ current_prompt: `Test agente ${id}: ajustar salida JSON.`, user_suggestion: 'refinar salida y ejemplos' })
    const t0 = Date.now()
    const r = await jsonFetch(`http://localhost:5000/api/agents/${id}/improve-prompt`, { method: 'POST', body, timeout: 90000 })
    const dur = Date.now() - t0
    let okStruct = false
    let notes = ''
    let example = ''
    if (r.ok) {
      const s = r.data && r.data.suggestions ? r.data.suggestions : r.data
      notes = s && s.notes ? String(s.notes) : ''
      example = s && s.example_prompt ? String(s.example_prompt) : ''
      okStruct = /\{\s*"say"\s*:\s*|"action"/i.test(example)
    }
    results.push({ id, status: r.status, ok: r.ok, durationMs: dur, okStruct, notesLen: (notes||'').length, exampleLen: (example||'').length })
  }
  while (idx < TEST_IDS.length) {
    const batch = TEST_IDS.slice(idx, idx+CONC)
    await Promise.all(batch.map(runOne))
    idx += CONC
  }

  const traces = await jsonFetch('http://localhost:5000/api/debug/traces?limit=20', { method: 'GET', timeout: 15000 })
  console.log(JSON.stringify({ mode: FULL ? 'full' : 'subset', totalAgents: agentes.length, tested: TEST_IDS.length, promptChecks, testResults: results, traces: traces.ok ? traces.data.data : [] }, null, 2))
}

run().catch(e => { console.error('❌ Prueba falló:', e.message); process.exit(1) })