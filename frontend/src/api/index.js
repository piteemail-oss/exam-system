import {
  initDatabase,
  createCategory as dbCreateCategory,
  getCategories as dbGetCategories,
  deleteCategory as dbDeleteCategory,
  createQuestion as dbCreateQuestion,
  getQuestionsByCategory,
  getWrongQuestions as dbGetWrongQuestions,
  cutWrongQuestion as dbCutWrongQuestion,
  cutWrongQuestionByQuestionId as dbCutWrongQuestionByQuestionId,
  submitExam as dbSubmitExam,
  exportDatabase,
  importDatabase,
  previewImport,
  importQuestions as dbImportQuestions
} from '../db/database.js'

// 确保数据库已初始化
let dbReady = initDatabase()

// 包装函数：让返回值兼容 axios 的 res.data 格式
function wrap(fn) {
  return async (...args) => {
    await dbReady
    const data = await fn(...args)
    return { data }
  }
}

// Category APIs
export const getCategories = wrap(dbGetCategories)
export const createCategory = wrap((name) => dbCreateCategory(name.name || name))
export const deleteCategory = wrap(dbDeleteCategory)

// Question APIs
export const createQuestion = wrap(dbCreateQuestion)
export const getQuestions = wrap((categoryId, random = false, limit = null) =>
  getQuestionsByCategory(categoryId, random, limit)
)

// Wrong Question APIs
export const getWrongQuestions = wrap((categoryId = null, random = false, limit = null) =>
  dbGetWrongQuestions(categoryId, random, limit)
)
export const cutWrongQuestion = wrap(dbCutWrongQuestion)
export const cutWrongQuestionByQuestionId = wrap(dbCutWrongQuestionByQuestionId)

// Exam APIs
export const submitExam = wrap(dbSubmitExam)

// Backup and Restore (文件操作需要特殊处理)
export const backupDatabase = async () => {
  await dbReady
  const data = exportDatabase()
  if (!data) throw new Error('数据库未初始化')
  const blob = new Blob([data], { type: 'application/octet-stream' })
  return { data: blob }
}

export const restoreDatabase = async (file) => {
  await dbReady
  const buffer = await file.arrayBuffer()
  await importDatabase(buffer)
  return { data: { success: true } }
}

// Import
export const importQuestions = async (file) => {
  await dbReady
  const data = await dbImportQuestions(file)
  return { data }
}

export const previewImportQuestions = async (file) => {
  await dbReady
  const data = await previewImport(file)
  return { data }
}

export default { backupDatabase, restoreDatabase }
