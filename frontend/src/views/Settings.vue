<template>
  <div class="min-h-screen bg-gray-50 p-4 md:p-8">
    <div class="max-w-2xl mx-auto">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">系统设置</h1>
        <router-link to="/" class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
          返回首页
        </router-link>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 class="text-lg font-semibold mb-4">📦 数据库管理</h3>
        <p class="text-gray-600 mb-4">
          所有数据存储在手机本地，无需网络。你可以导入已有的 <code class="bg-gray-100 px-1 rounded">exam.db</code> 数据库文件，或备份当前数据。
        </p>

        <div class="flex gap-4 flex-wrap items-center mb-4">
          <button
            @click="handleBackup"
            class="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            📥 导出数据库
          </button>

          <label class="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition cursor-pointer">
            📤 导入数据库
            <input
              type="file"
              class="hidden"
              @change="handleRestore"
              accept=".db"
            />
          </label>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 class="text-lg font-semibold mb-4">📚 导入题库</h3>
        <div class="mt-6 flex flex-col md:flex-row md:items-center gap-3">
          <label class="inline-flex items-center px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition cursor-pointer">
            📚 预览导入题库
            <input 
              type="file" 
              class="hidden" 
              @change="handlePreviewImport"
              accept=".csv,.xlsx"
            />
          </label>
          <button 
            @click="downloadTemplate"
            class="px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition"
          >
            📄 下载导入模板
          </button>
        </div>
        <div class="text-sm text-gray-500 mt-2 space-y-2">
          <p>支持 CSV / XLSX 文件。字段说明如下：</p>
          <ul class="list-disc list-inside">
            <li><strong>category_name</strong>：科目名称，若该科目不存在会自动创建。</li>
            <li><strong>category_id</strong>：可选，优先使用该科目 ID；未填写时按 category_name 匹配。</li>
            <li><strong>type</strong>：题型，1=单选，2=多选，3=判断。</li>
            <li><strong>content</strong>：题干文本。</li>
            <li><strong>option_A ~ option_F</strong>：选项内容，多选题可填写多个选项，判断题可不填。</li>
            <li><strong>correct_answer</strong>：标准答案，单选/判断写 A，多个答案写 A,C。</li>
            <li><strong>analysis</strong>：解析说明，可选。</li>
          </ul>
        </div>
        <div v-if="previewReady" class="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div class="text-sm font-medium text-slate-700">导入预览</div>
              <div class="text-sm text-slate-600">有效题目：{{ validCount }} 条，错误题目：{{ invalidCount }} 条</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button
                @click="handleConfirmImport"
                class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                :disabled="importing || validCount === 0"
              >
                确认导入 {{ validCount }} 条有效题目
              </button>
              <button
                @click="resetPreview"
                class="px-4 py-2 bg-gray-200 text-slate-700 rounded-lg hover:bg-gray-300 transition"
              >
                重新选择文件
              </button>
              <button
                @click="downloadInvalidRows"
                class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                :disabled="invalidCount === 0"
              >
                导出错误行
              </button>
            </div>
          </div>

          <div v-if="previewErrors.length" class="mt-4 text-sm text-red-600">
            <div class="font-medium">前 {{ previewErrors.length }} 条错误：</div>
            <ul class="list-disc list-inside space-y-1">
              <li v-for="err in previewErrors.slice(0, 5)" :key="err.row">第 {{ err.row }} 行：{{ err.message }}</li>
            </ul>
          </div>

          <div class="overflow-x-auto mt-4">
            <table class="min-w-full text-sm text-left border-collapse">
              <thead class="bg-slate-100 text-slate-700">
                <tr>
                  <th class="px-3 py-2 border border-slate-200">行号</th>
                  <th class="px-3 py-2 border border-slate-200">科目</th>
                  <th class="px-3 py-2 border border-slate-200">题型</th>
                  <th class="px-3 py-2 border border-slate-200">题干</th>
                  <th class="px-3 py-2 border border-slate-200">标准答案</th>
                  <th class="px-3 py-2 border border-slate-200">是否有效</th>
                  <th class="px-3 py-2 border border-slate-200">错误信息</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in previewRows.slice(0, 20)"
                  :key="row.row_number"
                  :class="row.valid ? 'bg-white' : 'bg-red-50'"
                >
                  <td class="px-3 py-2 border border-slate-200">{{ row.row_number }}</td>
                  <td class="px-3 py-2 border border-slate-200">{{ row.category_name || row.category_id }}</td>
                  <td class="px-3 py-2 border border-slate-200">{{ row.type }}</td>
                  <td class="px-3 py-2 border border-slate-200 truncate max-w-xs">{{ row.content }}</td>
                  <td class="px-3 py-2 border border-slate-200">{{ row.correct_answer }}</td>
                  <td class="px-3 py-2 border border-slate-200">{{ row.valid ? '是' : '否' }}</td>
                  <td class="px-3 py-2 border border-slate-200 text-red-600">{{ row.error }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-2 text-xs text-slate-500">仅展示前 20 行预览，实际导入结果请以导入后返回为准。</p>
        </div>
      </div>
      <div v-if="importResult" class="bg-white rounded-xl shadow-sm p-6 mt-6">
        <h3 class="text-lg font-semibold mb-4">导入结果</h3>
        <div class="text-sm text-slate-600">
          成功导入：<span class="font-medium text-slate-900">{{ importResult.success_count }}</span> 条，
          失败：<span class="font-medium text-red-600">{{ importResult.fail_count }}</span> 条
        </div>
        <div v-if="importResult.errors && importResult.errors.length" class="mt-4 text-sm text-red-600">
          <div class="font-medium mb-2">失败明细（前 10 条）：</div>
          <ul class="list-disc list-inside space-y-1">
            <li v-for="err in importResult.errors.slice(0, 10)" :key="err.row">第 {{ err.row }} 行：{{ err.message }}</li>
          </ul>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-lg font-semibold mb-4">关于系统</h3>
        <p class="text-gray-600">
          个人轻量化多科目考试问答系统 v1.0<br>
          一款面向个人用户的刷题、错题复习工具，无需复杂部署，开箱即用。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { backupDatabase, restoreDatabase, importQuestions, previewImportQuestions } from '../api'

const selectedFile = ref(null)
const previewRows = ref([])
const previewErrors = ref([])
const validCount = ref(0)
const invalidCount = ref(0)
const previewReady = ref(false)
const importResult = ref(null)
const importing = ref(false)

const handleBackup = async () => {
  try {
    const res = await backupDatabase()
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `exam_backup_${new Date().toISOString().slice(0,10)}.db`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    alert('备份成功！')
  } catch (e) {
    alert('备份失败：' + e.message)
  }
}

const handleRestore = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  if (!confirm('确定要恢复数据吗？这将覆盖当前所有数据，无法恢复！')) return
  
  try {
    await restoreDatabase(file)
    alert('恢复成功！页面将刷新')
    window.location.reload()
  } catch (e) {
    alert('恢复失败：' + e.message)
  }
}

const handlePreviewImport = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  selectedFile.value = file
  try {
    const res = await previewImportQuestions(file)
    const data = res.data
    previewRows.value = data.preview_rows || []
    validCount.value = data.valid_count || 0
    invalidCount.value = data.invalid_count || 0
    previewErrors.value = data.errors || []
    previewReady.value = true
    e.target.value = ''
  } catch (e) {
    previewReady.value = false
    alert('预览失败：' + e.message)
  }
}

const handleConfirmImport = async () => {
  if (!selectedFile.value) return
  if (!confirm(`确认导入 ${validCount.value} 条有效题目吗？`)) return
  importing.value = true
  try {
    const res = await importQuestions(selectedFile.value)
    const data = res.data
    importResult.value = data
    alert(`导入完成：成功 ${data.success_count} 条，失败 ${data.fail_count} 条`)
    if (data.errors && data.errors.length > 0) {
      console.error('导入失败明细：', data.errors)
      alert('部分行导入失败，请打开控制台查看详细错误。')
    }
    resetPreview()
  } catch (e) {
    alert('导入失败：' + e.message)
  } finally {
    importing.value = false
  }
}

const resetPreview = () => {
  selectedFile.value = null
  previewRows.value = []
  previewErrors.value = []
  validCount.value = 0
  invalidCount.value = 0
  previewReady.value = false
  importResult.value = null
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
  const templateRows = [
    {
      category_name: '历史',
      category_id: '',
      type: '1',
      content: '中国第一位皇帝是？',
      option_A: '秦始皇',
      option_B: '汉高祖',
      option_C: '唐太宗',
      option_D: '宋太祖',
      option_E: '',
      option_F: '',
      correct_answer: 'A',
      analysis: '秦始皇统一六国'
    }
  ]
  const csv = arrayToCsv(templateRows)
  const bom = '\uFEFF'
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

const downloadInvalidRows = () => {
  const invalidRows = previewRows.value.filter(row => !row.valid)
  if (!invalidRows.length) {
    alert('当前没有错误行可导出。')
    return
  }
  const csv = arrayToCsv(invalidRows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'import_errors.csv')
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
</script>
