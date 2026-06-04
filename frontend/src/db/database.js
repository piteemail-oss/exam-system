import initSqlJs from 'sql.js'
import * as XLSX from 'xlsx'

let SQL = null
let db = null
const DB_NAME = 'exam-system'
const DB_STORE = 'database'
const DB_KEY = 'exam.db'

// ==================== IndexedDB 持久化 ====================

function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) {
        request.result.createObjectStore(DB_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function loadFromIDB() {
  const idb = await openIDB()
  return new Promise((resolve) => {
    const tx = idb.transaction(DB_STORE, 'readonly')
    const store = tx.objectStore(DB_STORE)
    const getReq = store.get(DB_KEY)
    getReq.onsuccess = () => {
      idb.close()
      resolve(getReq.result || null)
    }
    getReq.onerror = () => {
      idb.close()
      resolve(null)
    }
  })
}

async function saveToIDB(data) {
  const idb = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readwrite')
    const store = tx.objectStore(DB_STORE)
    store.put(data, DB_KEY)
    tx.oncomplete = () => { idb.close(); resolve() }
    tx.onerror = () => { idb.close(); reject(tx.error) }
  })
}

// ==================== 初始化 ====================

export async function initDatabase() {
  if (SQL && db) return db

  // 手动加载 WASM 文件，避免 locateFile 路径解析问题
  const wasmUrl = import.meta.env.BASE_URL + 'sql-wasm.wasm'
  const wasmResponse = await fetch(wasmUrl)
  if (!wasmResponse.ok) {
    throw new Error(`无法加载 WASM 文件: ${wasmUrl} (HTTP ${wasmResponse.status})`)
  }
  const wasmBuffer = await wasmResponse.arrayBuffer()

  SQL = await initSqlJs({
    wasmBinary: new Uint8Array(wasmBuffer)
  })

  // 尝试从 IndexedDB 加载已有数据库
  let loaded = false
  try {
    const saved = await loadFromIDB()
    if (saved) {
      db = new SQL.Database(new Uint8Array(saved))
      loaded = true
    }
  } catch (e) {
    console.warn('[db] 无法从 IndexedDB 加载数据库，将创建新库', e)
  }

  if (!db) {
    db = new SQL.Database()
  }

  createTables()
  if (!loaded) {
    // 首次创建，写入 IndexedDB
    try { await saveToIDB(db.export()) } catch {}
  }
  return db
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS category (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      create_time TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS question (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES category(id),
      type INTEGER NOT NULL,
      content TEXT NOT NULL,
      options TEXT NOT NULL DEFAULT '[]',
      correct_answer TEXT NOT NULL,
      analysis TEXT,
      create_time TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS wrongquestion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL UNIQUE REFERENCES question(id),
      user_answer TEXT,
      wrong_count INTEGER NOT NULL DEFAULT 1,
      update_time TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS examrecord (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES category(id),
      is_wrong_mode INTEGER NOT NULL DEFAULT 0,
      score REAL NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      answers TEXT NOT NULL DEFAULT '[]',
      create_time TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `)
}

// ==================== OPFS 持久化 ====================

export async function saveDatabase() {
  if (!db) return
  const data = db.export()
  await saveToIDB(data)
}

// ==================== 工具函数 ====================

export function normalizeAnswer(answer) {
  if (answer === null || answer === undefined) return ''
  answer = String(answer).trim().toUpperCase()
  if (!answer) return ''
  const parts = answer.replace(/，/g, ',').split(',').map(s => s.trim()).filter(Boolean)
  return parts.sort().join(',')
}

function fmtTime() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19)
}

function jsonFields(row, fields) {
  if (!row) return row
  const obj = { ...row }
  for (const f of fields) {
    if (typeof obj[f] === 'string') {
      try { obj[f] = JSON.parse(obj[f]) } catch {}
    }
  }
  return obj
}

// ==================== 科目 CRUD ====================

export async function createCategory(name) {
  db.run('INSERT INTO category (name) VALUES (?)', [name])
  const row = db.exec('SELECT * FROM category WHERE id = last_insert_rowid()')
  await saveDatabase()
  return rowToObject(row)[0]
}

export function getCategories() {
  const cats = db.exec('SELECT * FROM category ORDER BY id')
  const rows = rowToObject(cats)
  return rows.map(cat => {
    const total = db.exec('SELECT COUNT(*) as cnt FROM question WHERE category_id = ?', [cat.id])
    const totalCnt = total[0] ? total[0].values[0][0] : 0

    const latestExam = db.exec(
      "SELECT * FROM examrecord WHERE category_id = ? AND is_wrong_mode = 0 ORDER BY create_time DESC LIMIT 1",
      [cat.id]
    )
    const examRows = rowToObject(latestExam)
    const correctRate = examRows.length > 0 ? (examRows[0].score || 0) : 0

    const wrongCnt = db.exec(
      "SELECT COUNT(*) as cnt FROM wrongquestion WHERE question_id IN (SELECT id FROM question WHERE category_id = ?)",
      [cat.id]
    )
    const wrongCount = wrongCnt[0] ? wrongCnt[0].values[0][0] : 0

    return {
      id: cat.id,
      name: cat.name,
      create_time: cat.create_time,
      question_count: totalCnt,
      correct_rate: Math.round(correctRate * 100) / 100,
      wrong_count: wrongCount
    }
  })
}

export async function deleteCategory(categoryId) {
  // 级联删除
  const questions = db.exec('SELECT id FROM question WHERE category_id = ?', [categoryId])
  const qIds = rowToObject(questions)
  for (const q of qIds) {
    db.run('DELETE FROM wrongquestion WHERE question_id = ?', [q.id])
    db.run('DELETE FROM question WHERE id = ?', [q.id])
  }
  db.run('DELETE FROM examrecord WHERE category_id = ?', [categoryId])
  db.run('DELETE FROM category WHERE id = ?', [categoryId])
  await saveDatabase()
  return true
}

// ==================== 题目 CRUD ====================

export async function createQuestion(data) {
  const optionsJson = JSON.stringify(data.options || [])
  db.run(
    'INSERT INTO question (category_id, type, content, options, correct_answer, analysis) VALUES (?,?,?,?,?,?)',
    [data.category_id, data.type, data.content, optionsJson, data.correct_answer, data.analysis || null]
  )
  const row = db.exec('SELECT * FROM question WHERE id = last_insert_rowid()')
  await saveDatabase()
  return jsonFields(rowToObject(row)[0], ['options'])
}

export function getQuestionsByCategory(categoryId, random = false, limit = null) {
  let sql = 'SELECT * FROM question WHERE category_id = ?'
  if (random) sql += ' ORDER BY RANDOM()'
  if (limit) sql += ' LIMIT ?'
  const params = [categoryId]
  if (limit) params.push(limit)
  const result = db.exec(sql, params)
  return rowToObject(result).map(r => jsonFields(r, ['options']))
}

// ==================== 错题 CRUD ====================

export function getWrongQuestions(categoryId = null, random = false, limit = null) {
  let sql = 'SELECT wq.* FROM wrongquestion wq'
  const params = []
  if (categoryId) {
    sql += ' INNER JOIN question q ON wq.question_id = q.id WHERE q.category_id = ?'
    params.push(categoryId)
  }
  if (random) {
    sql += ' ORDER BY RANDOM() * wq.wrong_count DESC'
  } else {
    sql += ' ORDER BY wq.wrong_count DESC'
  }
  if (limit) {
    sql += ' LIMIT ?'
    params.push(limit)
  }
  const result = db.exec(sql, params)
  const wrongQuestions = rowToObject(result)

  return wrongQuestions.map(wq => {
    const qRows = db.exec('SELECT * FROM question WHERE id = ?', [wq.question_id])
    const questions = rowToObject(qRows).map(r => jsonFields(r, ['options']))
    return {
      id: wq.id,
      question: questions[0] || null,
      user_answer: wq.user_answer,
      wrong_count: wq.wrong_count,
      update_time: wq.update_time
    }
  })
}

export async function updateWrongQuestion(questionId, userAnswer, persist = true) {
  if (!userAnswer || !String(userAnswer).trim()) return null
  const existing = db.exec('SELECT * FROM wrongquestion WHERE question_id = ?', [questionId])
  const rows = rowToObject(existing)

  if (rows.length > 0) {
    db.run(
      "UPDATE wrongquestion SET wrong_count = wrong_count + 1, user_answer = ?, update_time = ? WHERE question_id = ?",
      [userAnswer, fmtTime(), questionId]
    )
  } else {
    db.run(
      'INSERT INTO wrongquestion (question_id, user_answer, wrong_count) VALUES (?,?,1)',
      [questionId, userAnswer]
    )
  }
  if (persist) await saveDatabase()
  const result = db.exec('SELECT * FROM wrongquestion WHERE question_id = ?', [questionId])
  return rowToObject(result)[0]
}

export async function cutWrongQuestion(wrongId) {
  const existing = db.exec('SELECT * FROM wrongquestion WHERE id = ?', [wrongId])
  if (rowToObject(existing).length > 0) {
    db.run('DELETE FROM wrongquestion WHERE id = ?', [wrongId])
    await saveDatabase()
    return true
  }
  return false
}

export async function cutWrongQuestionByQuestionId(questionId) {
  const existing = db.exec('SELECT * FROM wrongquestion WHERE question_id = ?', [questionId])
  if (rowToObject(existing).length > 0) {
    db.run('DELETE FROM wrongquestion WHERE question_id = ?', [questionId])
    await saveDatabase()
    return true
  }
  return false
}

// ==================== 考试 CRUD ====================

export async function submitExam(data) {
  const answers = data.answers.filter(a => a.user_answer && String(a.user_answer).trim())
  const total = answers.length
  let correct = 0

  for (const ans of answers) {
    const qRows = db.exec('SELECT * FROM question WHERE id = ?', [ans.question_id])
    const questions = rowToObject(qRows)
    if (questions.length === 0) continue

    const q = questions[0]
    const normalizedCorrect = normalizeAnswer(q.correct_answer)
    const normalizedUser = normalizeAnswer(ans.user_answer)

    if (normalizedUser === normalizedCorrect) {
      correct++
      // 删除错题记录
      db.run('DELETE FROM wrongquestion WHERE question_id = ?', [ans.question_id])
    } else {
      await updateWrongQuestion(ans.question_id, ans.user_answer, false)
    }
  }

  const score = total > 0 ? (correct / total) * 100 : 0
  const answersJson = JSON.stringify(data.answers)

  db.run(
    'INSERT INTO examrecord (category_id, is_wrong_mode, score, total, answers) VALUES (?,?,?,?,?)',
    [data.category_id, data.is_wrong_mode || 0, score, total, answersJson]
  )
  await saveDatabase()

  const recordRow = db.exec('SELECT * FROM examrecord WHERE id = last_insert_rowid()')
  const record = rowToObject(recordRow)[0]

  return {
    score,
    total,
    correct,
    record_id: record ? record.id : 0
  }
}

// ==================== 导入/导出 ====================

export function exportDatabase() {
  if (!db) return null
  return db.export()
}

export async function importDatabase(buffer) {
  if (db) {
    db.close()
  }
  db = new SQL.Database(new Uint8Array(buffer))
  createTables()
  await saveToIDB(db.export())
  return true
}

// ==================== 导出题目 CSV ====================

export function exportQuestionsCSV(categoryId) {
  const questions = getQuestionsByCategory(categoryId, false, null)
  const category = db.exec('SELECT name FROM category WHERE id = ?', [categoryId])
  const catName = rowToObject(category)[0]?.name || 'unknown'

  const headers = ['category_name', 'type', 'content', 'option_A', 'option_B', 'option_C', 'option_D', 'option_E', 'option_F', 'correct_answer', 'analysis']
  const rows = [headers.join(',')]

  for (const q of questions) {
    const options = q.options || []
    const row = [
      catName,
      q.type,
      q.content,
      options.find(o => o.alias === 'A')?.text || '',
      options.find(o => o.alias === 'B')?.text || '',
      options.find(o => o.alias === 'C')?.text || '',
      options.find(o => o.alias === 'D')?.text || '',
      options.find(o => o.alias === 'E')?.text || '',
      options.find(o => o.alias === 'F')?.text || '',
      q.correct_answer,
      q.analysis || ''
    ]
    rows.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  }

  return rows.join('\n')
}

// ==================== CSV/XLSX 导入 ====================

export async function previewImport(file) {
  const rows = await readImportFile(file)
  const previewRows = []
  let validCount = 0, invalidCount = 0
  const errors = []

  rows.forEach((raw, index) => {
    const previewData = buildPreviewRow(raw, index + 2)
    try {
      validateImportRow(raw)
      previewData.valid = true
      validCount++
    } catch (e) {
      previewData.valid = false
      previewData.error = e.message || String(e)
      invalidCount++
      errors.push({ row: index + 2, message: e.message || String(e) })
    }
    previewRows.push(previewData)
  })

  return { preview_rows: previewRows, valid_count: validCount, invalid_count: invalidCount, errors }
}

export async function importQuestions(file) {
  const rows = await readImportFile(file)
  let successCount = 0
  const errors = []

  for (let i = 0; i < rows.length; i++) {
    try {
      const data = parseImportRow(rows[i])
      let category = getCategoryByName(data.category_name)
      if (!category) {
        await createCategory(data.category_name)
        category = getCategoryByName(data.category_name)
      }
      await createQuestion({
        category_id: category.id,
        type: data.type,
        content: data.content,
        options: data.options,
        correct_answer: data.correct_answer,
        analysis: data.analysis
      })
      successCount++
    } catch (e) {
      errors.push({ row: i + 2, message: e.message || String(e) })
    }
  }

  return { success_count: successCount, fail_count: errors.length, errors }
}

// ==================== 文件读取辅助 ====================

function normalizeHeader(value) {
  return (value || '').trim().toLowerCase()
}

async function readImportFile(file) {
  const filename = file.name.toLowerCase()
  if (filename.endsWith('.csv')) {
    const text = await file.text()
    return parseCSV(text)
  } else if (filename.match(/\.xlsx?$/)) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
    if (rows.length === 0) return []
    const headers = rows[0].map(h => normalizeHeader(String(h ?? '')))
    const dataRows = []
    for (let i = 1; i < rows.length; i++) {
      const row = {}
      headers.forEach((header, index) => {
        row[header] = rows[i]?.[index] != null ? String(rows[i][index]).trim() : ''
      })
      dataRows.push(row)
    }
    return dataRows
  } else {
    throw new Error('只支持 CSV 或 XLSX 文件')
  }
}

function parseCSV(text) {
  // 去除 BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => normalizeHeader(h))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim()
    })
    rows.push(row)
  }
  return rows
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

// ==================== 导入解析 ====================

function getCategoryByName(name) {
  const rows = db.exec('SELECT * FROM category WHERE name = ?', [name])
  return rowToObject(rows)[0] || null
}

function parseImportRow(row) {
  const categoryName = (row.category_name || row.category || '').trim()
  const typeValue = (row.type || '').trim()
  const content = (row.content || '').trim()
  const correctAnswer = (row.correct_answer || '').trim()
  const analysis = (row.analysis || '').trim()

  if (!categoryName) throw new Error('category_name 必填')
  if (!typeValue) throw new Error('type 必填，1=单选，2=多选，3=判断')

  const questionType = parseInt(typeValue)
  if (isNaN(questionType) || ![1, 2, 3].includes(questionType)) {
    throw new Error('type 必须为 1、2 或 3')
  }
  if (!content) throw new Error('content 不能为空')
  if (!correctAnswer) throw new Error('correct_answer 不能为空')

  const options = []
  for (const alias of ['A', 'B', 'C', 'D', 'E', 'F']) {
    const value = row[`option_${alias.toLowerCase()}`] || row[`option_${alias}`] || ''
    const text = value.trim()
    if (text) options.push({ alias, text })
  }

  let normalizedAnswer
  if (questionType === 3) {
    if (options.length === 0) {
      options.push({ alias: 'A', text: '对' }, { alias: 'B', text: '错' })
    }
    normalizedAnswer = correctAnswer.toUpperCase()
  } else {
    if (options.length < 2) throw new Error('单选/多选题至少需要两个选项')
    normalizedAnswer = correctAnswer
      .replace(/，/g, ',')
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
      .join(',')
  }

  return {
    category_name: categoryName,
    type: questionType,
    content,
    options,
    correct_answer: normalizedAnswer,
    analysis: analysis || null
  }
}

function validateImportRow(row) {
  const data = parseImportRow(row)
  return data
}

function buildPreviewRow(raw, rowNumber) {
  return {
    row_number: rowNumber,
    category_name: raw.category_name || raw.category || '',
    category_id: raw.category_id || '',
    type: raw.type || '',
    content: raw.content || '',
    option_A: raw.option_a || raw.option_A || '',
    option_B: raw.option_b || raw.option_B || '',
    option_C: raw.option_c || raw.option_C || '',
    option_D: raw.option_d || raw.option_D || '',
    option_E: raw.option_e || raw.option_E || '',
    option_F: raw.option_f || raw.option_F || '',
    correct_answer: raw.correct_answer || '',
    analysis: raw.analysis || '',
    valid: false,
    error: ''
  }
}

// ==================== 辅助 ====================

function rowToObject(result) {
  if (!result || result.length === 0) return []
  const columns = result[0].columns
  const values = result[0].values
  return values.map(row => {
    const obj = {}
    columns.forEach((col, i) => {
      obj[col] = row[i]
    })
    return obj
  })
}
