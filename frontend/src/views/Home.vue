<template>
  <div class="min-h-screen bg-gray-50 p-4 md:p-8">
    <div class="max-w-6xl mx-auto">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">考试问答系统</h1>
        <div class="flex gap-2">
          <router-link to="/exam-setup" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
            考试
          </router-link>
          <router-link to="/settings" class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
            设置
          </router-link>
        </div>
      </div>

      <!-- 空状态：无科目时显示导入 -->
      <div v-if="categories.length === 0" class="max-w-2xl mx-auto">
        <div class="text-center py-12">
          <div class="text-5xl mb-4">📚</div>
          <div class="text-gray-500 mb-6">还没有题目，导入题库开始使用</div>
          <div class="flex gap-3 justify-center flex-wrap">
            <label class="inline-flex items-center px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition cursor-pointer">
              预览导入题库
              <input type="file" class="hidden" @change="handlePreview" accept=".csv,.xlsx" />
            </label>
            <button @click="downloadTemplate" class="px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition">
              下载导入模板
            </button>
          </div>
          <div class="text-sm text-gray-500 mt-6 space-y-2 text-left">
            <p>支持 CSV / XLSX 文件。字段说明如下：</p>
            <ul class="list-disc list-inside space-y-1">
              <li><strong>category_name</strong>：科目名称，若该科目不存在会自动创建。</li>
              <li><strong>category_id</strong>：可选，优先使用该科目 ID；未填写时按 category_name 匹配。</li>
              <li><strong>type</strong>：题型，1=单选，2=多选，3=判断，4=简答。</li>
              <li><strong>content</strong>：题干文本。</li>
              <li><strong>option_A ~ option_F</strong>：选项内容，多选题可填写多个选项，判断题填正确和错误两个选型，简答题在 option_A 填写答案。</li>
              <li><strong>correct_answer</strong>：标准答案，单选/判断/简答写 A，多个答案写 A,C。</li>
              <li><strong>analysis</strong>：解析说明，可选。</li>
            </ul>
          </div>
        </div>

        <!-- 预览结果 -->
        <div v-if="previewReady" ref="previewRef" class="bg-white rounded-xl shadow-sm p-6 mt-6">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div class="text-sm font-medium text-slate-700">导入预览</div>
              <div class="text-sm text-slate-600">有效题目：{{ validCount }} 条，错误题目：{{ invalidCount }} 条</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button @click="handleConfirmImport" :disabled="importing || validCount === 0"
                class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
                确认导入 {{ validCount }} 条
              </button>
              <button @click="resetPreview" class="px-4 py-2 bg-gray-200 text-slate-700 rounded-lg hover:bg-gray-300 transition">
                重新选择
              </button>
            </div>
          </div>
          <div class="overflow-x-auto mt-4">
            <table class="min-w-full text-sm text-left border-collapse">
              <thead class="bg-slate-100 text-slate-700">
                <tr>
                  <th class="px-3 py-2 border border-slate-200">行号</th>
                  <th class="px-3 py-2 border border-slate-200">科目</th>
                  <th class="px-3 py-2 border border-slate-200">题型</th>
                  <th class="px-3 py-2 border border-slate-200">题干</th>
                  <th class="px-3 py-2 border border-slate-200">答案</th>
                  <th v-if="invalidCount === 0" class="px-3 py-2 border border-slate-200">有效</th>
                  <th class="px-3 py-2 border border-slate-200">错误信息</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in displayRows" :key="row.row_number" :class="row.valid ? 'bg-white' : 'bg-red-50'">
                  <td class="px-3 py-2 border border-slate-200">{{ row.row_number }}</td>
                  <td class="px-3 py-2 border border-slate-200">{{ row.category_name || row.category_id }}</td>
                  <td class="px-3 py-2 border border-slate-200">{{ row.type }}</td>
                  <td class="px-3 py-2 border border-slate-200 truncate max-w-xs">{{ row.content }}</td>
                  <td class="px-3 py-2 border border-slate-200">{{ row.correct_answer }}</td>
                  <td v-if="invalidCount === 0" class="px-3 py-2 border border-slate-200">{{ row.valid ? '是' : '否' }}</td>
                  <td class="px-3 py-2 border border-slate-200" :class="row.valid ? '' : 'text-red-600'">{{ row.error }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="invalidCount > 0" class="mt-3 flex gap-2">
            <button @click="downloadErrorRows" class="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition">
              导出 {{ invalidCount }} 条错误行
            </button>
          </div>
          <p v-if="invalidCount === 0" class="mt-2 text-xs text-slate-500">仅展示前 20 行预览</p>
        </div>
      </div>

      <!-- 科目列表 -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="cat in categories" 
          :key="cat.id"
          class="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition"
        >
          <h3 class="text-xl font-semibold text-gray-900 mb-4">{{ cat.name }}</h3>

          <div class="grid grid-cols-2 gap-4 mb-6 text-center">
            <div>
              <div class="text-2xl font-bold text-blue-600">{{ cat.question_count }}</div>
              <div class="text-xs text-gray-500">总题数</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-red-500">{{ cat.wrong_count }}</div>
              <div class="text-xs text-gray-500">错题数</div>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <router-link
              :to="`/exam/${cat.id}`"
              class="flex-1 min-w-[120px] px-3 py-2 bg-blue-500 text-white text-center rounded-lg hover:bg-blue-600 transition text-sm"
            >
              {{ getStartButtonText(cat.id, false) }}
            </router-link>
            <button
              @click="toggleCategoryFlashcard(cat)"
              class="min-w-[70px] px-2 py-2 rounded-lg transition text-sm"
              :class="isFlashcardMode(cat.id) ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'"
            >
              {{ isFlashcardMode(cat.id) ? '📇闪卡' : '闪卡' }}
            </button>
            <router-link 
              :to="`/wrong-exam/${cat.id}`"
              class="flex-1 min-w-[140px] px-3 py-2 bg-amber-500 text-white text-center rounded-lg hover:bg-amber-600 transition text-sm"
            >
              {{ getStartButtonText(cat.id, true) }}
            </router-link>
            <router-link 
              :to="`/category/${cat.id}/questions`"
              class="min-w-[110px] px-2 py-2 bg-gray-500 text-white text-center rounded-lg hover:bg-gray-600 transition text-sm"
            >
              题目列表
            </router-link>
            <router-link 
              :to="`/category/${cat.id}/wrong-questions`"
              class="min-w-[110px] px-2 py-2 bg-orange-500 text-white text-center rounded-lg hover:bg-orange-600 transition text-sm"
            >
              错题本
            </router-link>
            <button
              @click="handleDeleteCategory(cat)"
              class="min-w-[90px] px-2 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { getCategories, deleteCategory, previewImportQuestions, importQuestions } from '../api'

const categories = ref([])
const importFile = ref(null)
const importing = ref(false)
const previewReady = ref(false)
const previewRef = ref(null)
const previewRows = ref([])
const previewErrors = ref([])
const validCount = ref(0)
const invalidCount = ref(0)

const displayRows = computed(() => {
  if (invalidCount.value > 0) {
    return previewRows.value.filter(r => !r.valid).slice(0, 20)
  }
  return previewRows.value.slice(0, 20)
})

const loadCategories = async () => {
  const res = await getCategories()
  categories.value = res.data
}

const handlePreview = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  importFile.value = file
  try {
    const res = await previewImportQuestions(file)
    const data = res.data
    previewRows.value = data.preview_rows || []
    validCount.value = data.valid_count || 0
    invalidCount.value = data.invalid_count || 0
    previewErrors.value = data.errors || []
    previewReady.value = true
    e.target.value = ''
    await nextTick()
    previewRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (err) {
    previewReady.value = false
    alert('预览失败：' + (err.message || err))
  }
}

const handleConfirmImport = async () => {
  if (!importFile.value) return
  if (!confirm(`确认导入 ${validCount.value} 条有效题目吗？`)) return
  importing.value = true
  try {
    await importQuestions(importFile.value)
    resetPreview()
    await loadCategories()
  } catch (err) {
    alert('导入失败：' + (err.message || err))
  } finally {
    importing.value = false
  }
}

const downloadErrorRows = () => {
  const invalidRows = previewRows.value.filter(r => !r.valid)
  if (!invalidRows.length) return
  const csv = arrayToCsv(invalidRows)
  const bom = '﻿'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'import_errors.csv')
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const resetPreview = () => {
  importFile.value = null
  previewRows.value = []
  previewErrors.value = []
  validCount.value = 0
  invalidCount.value = 0
  previewReady.value = false
}

const arrayToCsv = (rows) => {
  if (!rows.length) return ''
  const header = Object.keys(rows[0]).filter(key => key !== 'valid' && key !== 'error')
  const lines = [header.join(',')]
  rows.forEach(row => {
    const values = header.map(key => {
      const value = row[key] == null ? '' : String(row[key]).replace(/"/g, '""')
      return `"${value}"`
    })
    lines.push(values.join(','))
  })
  return lines.join('\n')
}

const downloadTemplate = () => {
  const templateRows = [{
    category_name: '历史', category_id: '', type: '1', content: '中国第一位皇帝是？',
    option_A: '秦始皇', option_B: '汉高祖', option_C: '唐太宗', option_D: '宋太祖',
    option_E: '', option_F: '', correct_answer: 'A', analysis: '秦始皇统一六国'
  }, {
    category_name: '政治', category_id: '', type: '2', content: '以下哪些是基本经济制度？',
    option_A: '公有制', option_B: '私有制', option_C: '计划经济', option_D: '市场经济',
    option_E: '', option_F: '', correct_answer: 'A,B,D', analysis: '多种所有制经济共同发展'
  }, {
    category_name: '行测', category_id: '', type: '3', content: '"天下为公"正确吗？',
    option_A: '对', option_B: '错', option_C: '', option_D: '',
    option_E: '', option_F: '', correct_answer: 'A', analysis: '这是正确说法'
  }, {
    category_name: '历史', category_id: '', type: '4', content: '简述秦始皇统一六国的意义。',
    option_A: '结束了长期分裂割据，建立了中国历史上第一个统一的多民族中央集权国家。', option_B: '', option_C: '', option_D: '',
    option_E: '', option_F: '', correct_answer: 'A', analysis: '从政治、经济、文化三方面作答'
  }]
  const csv = arrayToCsv(templateRows)
  const bom = '﻿'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'question_import_template.csv')
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const isFlashcardMode = (categoryId) => {
  return localStorage.getItem('flashcard_' + categoryId) === '1'
}

const toggleCategoryFlashcard = (cat) => {
  const key = 'flashcard_' + cat.id
  const current = localStorage.getItem(key) === '1'
  localStorage.setItem(key, current ? '0' : '1')
  // 强制重新渲染
  categories.value = [...categories.value]
}

const handleDeleteCategory = async (cat) => {
  if (!confirm(`确定要删除科目「${cat.name}」吗？这将删除该科目下的所有题目和记录，无法恢复。`)) return
  await deleteCategory(cat.id)
  await loadCategories()
}

const getProgressKey = (categoryId, isWrongMode) => {
  return `exam_progress_${categoryId}_${isWrongMode ? 'wrong' : 'normal'}`
}

const hasSavedProgress = (categoryId, isWrongMode) => {
  try {
    const key = getProgressKey(categoryId, isWrongMode)
    return !!localStorage.getItem(key)
  } catch (e) {
    return false
  }
}

const getStartButtonText = (categoryId, isWrongMode) => {
  return isWrongMode ? '错题强化' : (
    hasSavedProgress(categoryId, isWrongMode) ? '继续刷题' : '开始刷题'
  )
}

onMounted(() => {
  loadCategories()
})
</script>
