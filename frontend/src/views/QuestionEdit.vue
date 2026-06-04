<template>
  <div class="min-h-screen bg-gray-50 p-4 md:p-8">
    <div class="max-w-4xl mx-auto">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">题目列表</h1>
        <div class="flex gap-2">
          <button @click="loadQuestions" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
            刷新列表
          </button>
          <router-link to="/" class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
            返回首页
          </router-link>
        </div>
      </div>

      <div v-if="questions.length === 0" class="text-center py-16 text-gray-500">
        当前科目暂无题目，请先通过"预览导入题库"导入题目。
      </div>

      <div class="space-y-4">
        <div v-for="(q, index) in questions" :key="q.id" class="bg-white rounded-xl shadow-sm p-6">
          <div class="flex items-center gap-3 mb-3">
            <span class="w-6 h-6 bg-gray-100 text-gray-500 text-xs rounded-full flex items-center justify-center">{{ index + 1 }}</span>
            <span class="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded">
              {{ getQuestionTypeLabel(q.type) }}
            </span>
          </div>
          <div class="text-gray-900 font-medium mb-3">
            {{ q.content }}
          </div>
          <div class="space-y-2">
            <div v-for="opt in q.options" :key="opt.alias" class="flex items-center gap-2">
              <span class="w-6 font-medium">{{ opt.alias }}.</span>
              <span
                class="px-2 py-1 rounded text-sm"
                :class="{
                  'bg-green-100 text-green-600': q.correct_answer?.includes(opt.alias),
                  'text-gray-600': !q.correct_answer?.includes(opt.alias)
                }"
              >
                {{ opt.text }}
              </span>
            </div>
          </div>
          <div v-if="q.analysis" class="mt-3 text-sm text-gray-500">
            解析：{{ q.analysis }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getQuestions } from '../api'

const route = useRoute()
const categoryId = ref(parseInt(route.params.id))
const questions = ref([])

const loadQuestions = async () => {
  try {
    const res = await getQuestions(categoryId.value)
    questions.value = res.data
  } catch (error) {
    console.error(error)
    questions.value = []
  }
}

const getQuestionTypeLabel = (type) => {
  if (type === 1) return '单选题'
  if (type === 2) return '多选题'
  if (type === 3) return '判断题'
  return '未知题型'
}

onMounted(loadQuestions)
</script>
