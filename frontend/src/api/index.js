import axios from 'axios'

const api = axios.create({
  baseURL: '/api'
})

// Category APIs
export const getCategories = () => api.get('/categories/')
export const createCategory = (data) => api.post('/categories/', data)
export const deleteCategory = (id) => api.delete(`/categories/${id}`)

// Question APIs
export const createQuestion = (data) => api.post('/questions/', data)
export const getQuestions = (categoryId, random = false, limit = null) => {
  const params = { random }
  if (limit) params.limit = limit
  return api.get(`/questions/${categoryId}`, { params })
}

// Wrong Question APIs
export const getWrongQuestions = (categoryId = null, random = false, limit = null) => {
  const params = { random }
  if (categoryId) params.category_id = categoryId
  if (limit) params.limit = limit
  return api.get('/wrong-questions/', { params })
}
export const cutWrongQuestion = (wrongId) => api.post(`/wrong-questions/${wrongId}/cut/`)
export const cutWrongQuestionByQuestionId = (questionId) => api.post(`/wrong-questions/question/${questionId}/cut/`)

// Exam APIs
export const submitExam = (data) => api.post('/exam/submit/', data)

// Backup and Restore
export const backupDatabase = () => api.get('/backup/', { responseType: 'blob' })
export const restoreDatabase = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/restore/', formData)
}

export const importQuestions = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/questions/import/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const previewImportQuestions = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/questions/import/preview/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export default api
