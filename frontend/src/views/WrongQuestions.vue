<template>
  <div class="min-h-screen bg-gray-50 p-4 md:p-8">
    <div class="max-w-4xl mx-auto">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">科目错题本</h1>
        <div class="flex gap-2">
          <router-link :to="`/wrong-exam/${categoryId}`" class="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition">
            开始错题强化
          </router-link>
          <router-link to="/" class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
            返回首页
          </router-link>
        </div>
      </div>

      <div v-if="wrongQuestions.length === 0" class="text-center py-12">
        <div class="text-5xl mb-4">🎉</div>
        <div class="text-gray-500">太棒了！你已经没有错题了</div>
      </div>

      <div class="space-y-4">
        <div v-for="(wq, index) in wrongQuestions" :key="wq.id" class="bg-white rounded-xl shadow-sm p-6">
          <div class="flex justify-between items-start mb-3">
            <div class="flex items-center gap-3">
              <span class="w-6 h-6 bg-gray-100 text-gray-500 text-xs rounded-full flex items-center justify-center">{{ index + 1 }}</span>
              <span class="px-2 py-1 bg-red-100 text-red-600 text-xs rounded">
                错误 {{ wq.wrong_count }} 次
              </span>
            </div>
            <button 
              @click="handleCut(wq.id)"
              class="text-green-500 hover:text-green-700 text-sm"
            >
              ✂️ 斩题
            </button>
          </div>
          <div class="text-gray-900 font-medium mb-3">
            {{ wq.question.content }}
          </div>
          <div class="space-y-2">
            <div v-for="opt in wq.question.options" :key="opt.alias" class="flex items-center gap-2">
              <span class="w-6">{{ opt.alias }}.</span>
              <span 
                class="px-2 py-1 rounded text-sm"
                :class="{
                  'bg-green-100 text-green-600': wq.question.correct_answer?.includes(opt.alias),
                  'text-gray-600': !wq.question.correct_answer?.includes(opt.alias)
                }"
              >
                {{ opt.text }}
              </span>
            </div>
          </div>
          <div v-if="wq.question.analysis" class="mt-3 text-sm text-gray-600">
            解析：{{ wq.question.analysis }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getWrongQuestions, cutWrongQuestion } from '../api'

const props = defineProps(['categoryId'])
const wrongQuestions = ref([])

const loadWrongQuestions = async () => {
  const res = await getWrongQuestions(props.categoryId)
  wrongQuestions.value = res.data
}

const handleCut = async (id) => {
  if (!confirm('确定要斩掉这道题吗？标记为已掌握，从错题本移除。')) return
  await cutWrongQuestion(id)
  await loadWrongQuestions()
}

onMounted(() => {
  loadWrongQuestions()
})
</script>
