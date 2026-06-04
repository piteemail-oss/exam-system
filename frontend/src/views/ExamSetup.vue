<template>
  <div class="min-h-screen bg-gray-50 p-4 md:p-8">
    <div class="max-w-md mx-auto">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">考试设置</h1>
        <router-link to="/" class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
          返回首页
        </router-link>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <!-- 科目选择 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">选择科目</label>
          <select v-model="form.categoryId" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
            <option :value="null" disabled>请选择科目</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}（{{ cat.question_count }} 题）</option>
          </select>
        </div>

        <!-- 时长 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">考试时长（分钟，0 = 不限时）</label>
          <input v-model.number="form.duration" type="number" min="0" class="w-full px-4 py-2 border border-gray-300 rounded-lg" />
        </div>

        <!-- 题数 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">出题数量（0 = 全部）</label>
          <input v-model.number="form.limit" type="number" min="0" class="w-full px-4 py-2 border border-gray-300 rounded-lg" />
        </div>

        <!-- 模式 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">考试模式</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.flashcardMode" type="radio" :value="false" class="w-4 h-4 text-blue-600" />
              <span>普通模式</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.flashcardMode" type="radio" :value="true" class="w-4 h-4 text-blue-600" />
              <span>闪卡模式</span>
            </label>
          </div>
        </div>

        <button @click="startExam" :disabled="!form.categoryId" class="w-full py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50 text-lg font-medium">
          开始考试
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCategories } from '../api'

const router = useRouter()
const categories = ref([])
const form = ref({
  categoryId: null,
  duration: 0,
  limit: 0,
  flashcardMode: false
})

onMounted(async () => {
  const res = await getCategories()
  categories.value = res.data
})

const startExam = () => {
  const cat = categories.value.find(c => c.id === form.value.categoryId)
  router.push({
    path: `/exam/${form.value.categoryId}`,
    query: {
      exam: '1',
      duration: form.value.duration,
      limit: form.value.limit,
      flashcard: form.value.flashcardMode ? '1' : '0',
      catName: cat?.name || ''
    }
  })
}
</script>
