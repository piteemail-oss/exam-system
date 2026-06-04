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
          <select v-model="form.categoryId" :disabled="hasExisting" class="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100">
            <option :value="null" disabled>请选择科目</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}（{{ cat.question_count }} 题）</option>
          </select>
        </div>

        <!-- 时长 / 剩余时间 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ hasExisting ? '剩余时间' : '考试时长（分钟，0 = 不限时）' }}</label>
          <input v-if="!hasExisting" v-model.number="form.duration" type="number" min="0" class="w-full px-4 py-2 border border-gray-300 rounded-lg" />
          <div v-else class="w-full px-4 py-2 bg-gray-50 rounded-lg text-gray-700">{{ formatRemaining(existingState.timeLeft) }}</div>
        </div>

        <!-- 题数 / 剩余题量 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ hasExisting ? '剩余题量' : '出题数量（0 = 全部）' }}</label>
          <input v-if="!hasExisting" v-model.number="form.limit" type="number" min="0" class="w-full px-4 py-2 border border-gray-300 rounded-lg" />
          <div v-else class="w-full px-4 py-2 bg-gray-50 rounded-lg text-gray-700">
            共 {{ existingState.questions?.length || 0 }} 题，已做 {{ answeredCount }} 题，剩余 {{ remainingCount }} 题
          </div>
        </div>

        <!-- 模式 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">考试模式</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2" :class="hasExisting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'">
              <input v-model="form.flashcardMode" type="radio" :value="false" :disabled="hasExisting" class="w-4 h-4 text-blue-600" />
              <span>普通模式</span>
            </label>
            <label class="flex items-center gap-2" :class="hasExisting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'">
              <input v-model="form.flashcardMode" type="radio" :value="true" :disabled="hasExisting" class="w-4 h-4 text-blue-600" />
              <span>闪卡模式</span>
            </label>
          </div>
        </div>

        <button v-if="hasExisting" @click="continueExam" class="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-lg font-medium">
          继续考试
        </button>
        <button v-else @click="startExam" :disabled="!form.categoryId" class="w-full py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50 text-lg font-medium">
          开始考试
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCategories } from '../api'

const router = useRouter()
const categories = ref([])
const existingState = ref(null)

const form = ref({
  categoryId: null,
  duration: 0,
  limit: 0,
  flashcardMode: false
})

const hasExisting = computed(() => existingState.value !== null)
const answeredCount = computed(() => {
  if (!existingState.value) return 0
  const status = existingState.value.questionStatus || {}
  return Object.values(status).filter(s => s?.attempted).length
})
const remainingCount = computed(() => {
  if (!existingState.value) return 0
  return (existingState.value.questions?.length || 0) - answeredCount.value
})

onMounted(async () => {
  const res = await getCategories()
  categories.value = res.data
  // 检查是否有进行中的考试
  for (const cat of res.data) {
    const key = `exam_state_${cat.id}`
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        const state = JSON.parse(raw)
        if (state.categoryId == cat.id) {
          existingState.value = state
          form.value.categoryId = state.categoryId
          form.value.flashcardMode = state.flashcard || false
          break
        }
      } catch {}
    }
  }
})

const formatRemaining = (s) => {
  if (!s && s !== 0) return '不限时'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m} 分 ${sec} 秒`
}

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

const continueExam = () => {
  if (!existingState.value) return
  router.push({
    path: `/exam/${existingState.value.categoryId}`,
    query: {
      exam: '1',
      duration: existingState.value.duration,
      limit: existingState.value.limit,
      flashcard: existingState.value.flashcard ? '1' : '0'
    }
  })
}
</script>
