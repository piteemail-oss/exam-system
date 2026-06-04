<template>
  <div class="min-h-screen bg-gray-50 p-4 md:p-8">
    <div class="max-w-6xl mx-auto">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">题目列表</h1>
          <p class="text-sm text-gray-500 mt-1">展示当前科目的所有题目内容，方便快速浏览与核对。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <router-link to="/" class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
            返回首页
          </router-link>
          <button @click="loadQuestions" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
            刷新列表
          </button>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm p-6">
        <div v-if="questions.length === 0" class="text-center py-16 text-gray-500">
          当前科目暂无题目，请先通过“预览导入题库”导入题目。
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left font-medium text-gray-700">ID</th>
                <th class="px-4 py-3 text-left font-medium text-gray-700">题型</th>
                <th class="px-4 py-3 text-left font-medium text-gray-700">题干</th>
                <th class="px-4 py-3 text-left font-medium text-gray-700">选项</th>
                <th class="px-4 py-3 text-left font-medium text-gray-700">正确答案</th>
                <th class="px-4 py-3 text-left font-medium text-gray-700">解析</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="q in questions" :key="q.id">
                <td class="px-4 py-4 text-gray-700 align-top">{{ q.id }}</td>
                <td class="px-4 py-4 text-gray-700 align-top">{{ getQuestionTypeLabel(q.type) }}</td>
                <td class="px-4 py-4 text-gray-700 align-top whitespace-pre-line">{{ q.content }}</td>
                <td class="px-4 py-4 text-gray-700 align-top">
                  <div class="space-y-1">
                    <div v-for="opt in q.options" :key="opt.alias" class="flex gap-2">
                      <span class="font-medium">{{ opt.alias }}.</span>
                      <span class="break-words">{{ opt.text }}</span>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-4 text-gray-700 align-top whitespace-pre-line">{{ q.correct_answer }}</td>
                <td class="px-4 py-4 text-gray-700 align-top whitespace-pre-line">{{ q.analysis || '—' }}</td>
              </tr>
            </tbody>
          </table>
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
