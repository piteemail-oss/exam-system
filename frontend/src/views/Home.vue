<template>
  <div class="min-h-screen bg-gray-50 p-4 md:p-8">
    <div class="max-w-6xl mx-auto">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">考试问答系统</h1>
        <div class="flex gap-2">
          <router-link to="/settings" class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
            设置
          </router-link>
        </div>
      </div>

      <!-- 科目列表 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div 
          @click="showCreateModal = true"
          class="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition min-h-[200px]"
        >
          <div class="text-4xl text-gray-400 mb-2">+</div>
          <div class="text-gray-500">创建新科目</div>
        </div>

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
              class="flex-1 min-w-[140px] px-3 py-2 bg-blue-500 text-white text-center rounded-lg hover:bg-blue-600 transition text-sm"
            >
              {{ getStartButtonText(cat.id, false) }}
            </router-link>
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
              @click="handleExportCategory(cat)"
              class="min-w-[90px] px-2 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition text-sm"
            >
              导出
            </button>
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

    <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-semibold mb-4">创建新科目</h3>
        <input 
          v-model="newCategoryName"
          type="text" 
          placeholder="请输入科目名称"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          @keyup.enter="handleCreateCategory"
        />
        <div class="flex gap-2 justify-end">
          <button @click="showCreateModal = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
          <button @click="handleCreateCategory" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getCategories, createCategory, deleteCategory, exportCategoryQuestions } from '../api'

const categories = ref([])
const showCreateModal = ref(false)
const newCategoryName = ref('')

const loadCategories = async () => {
  const res = await getCategories()
  categories.value = res.data
}

const handleCreateCategory = async () => {
  if (!newCategoryName.value.trim()) return
  try {
    await createCategory({ name: newCategoryName.value.trim() })
    showCreateModal.value = false
    newCategoryName.value = ''
    await loadCategories()
  } catch (e) {
    alert('创建失败，科目名称可能已存在')
  }
}

const handleDeleteCategory = async (cat) => {
  if (!confirm(`确定要删除科目「${cat.name}」吗？这将删除该科目下的所有题目和记录，无法恢复。`)) return
  await deleteCategory(cat.id)
  await loadCategories()
}

const handleExportCategory = async (cat) => {
  try {
    const res = await exportCategoryQuestions(cat.id, cat.name)
    const url = window.URL.createObjectURL(res.data.blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', res.data.filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败：' + (e.message || e))
  }
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
