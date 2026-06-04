<template>
  <div class="min-h-screen bg-gray-50 p-4 md:p-8">
    <div class="max-w-4xl mx-auto">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">题目列表</h1>
        <div class="flex gap-2">
          <button @click="handleShowAll" class="px-3 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition">全显示</button>
          <button @click="handleHideAll" class="px-3 py-2 bg-gray-400 text-white text-sm rounded-lg hover:bg-gray-500 transition">全隐藏</button>
          <router-link to="/" class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">返回首页</router-link>
        </div>
      </div>

      <div v-if="allQuestions.length === 0" class="text-center py-16 text-gray-500">
        当前科目暂无题目，请先通过"预览导入题库"导入题目。
      </div>

      <div v-else>
        <div class="mb-4 flex gap-2">
          <input
            v-model="searchText"
            type="text"
            placeholder="搜索题目关键词…"
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            @click="showFavorites = !showFavorites"
            class="px-4 py-2 rounded-lg text-sm transition"
            :class="showFavorites ? 'bg-yellow-400 text-white' : 'bg-gray-200 text-gray-600'"
          >
            ⭐ 收藏
          </button>
        </div>

        <div v-if="questions.length === 0" class="text-center py-8 text-gray-400">
          没有匹配的题目
        </div>

        <div class="space-y-4">
          <div v-for="(q, index) in questions" :key="q.id"
          class="bg-white rounded-xl shadow-sm p-6"
          :class="{ 'opacity-50': q.hidden }"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <span class="w-6 h-6 bg-gray-100 text-gray-500 text-xs rounded-full flex items-center justify-center">{{ index + 1 }}</span>
              <span class="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded">
                {{ getQuestionTypeLabel(q.type) }}
              </span>
              <span v-if="q.hidden" class="px-2 py-1 bg-gray-100 text-gray-400 text-xs rounded">已隐藏</span>
              <button @click="handleToggleFavorite(q)" class="text-lg leading-none" :title="q.favorite ? '取消收藏' : '收藏'">
                {{ q.favorite ? '⭐' : '☆' }}
              </button>
            </div>
            <label class="flex items-center gap-2 cursor-pointer">
              <span class="text-xs text-gray-400">显示</span>
              <input
                type="checkbox"
                :checked="!q.hidden"
                @change="handleToggleHidden(q)"
                class="w-4 h-4 text-blue-600 rounded"
              />
            </label>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getQuestions, toggleQuestionHidden, toggleFavorite, batchToggleHidden } from '../api'

const route = useRoute()
const categoryId = ref(parseInt(route.params.id))
const allQuestions = ref([])
const searchText = ref('')
const showFavorites = ref(false)

const questions = computed(() => {
  let list = allQuestions.value
  if (showFavorites.value) {
    list = list.filter(q => q.favorite)
  }
  if (searchText.value.trim()) {
    const kw = searchText.value.trim().toLowerCase()
    list = list.filter(q =>
      q.content.toLowerCase().includes(kw) ||
      (q.analysis && q.analysis.toLowerCase().includes(kw))
    )
  }
  return list
})

const loadQuestions = async () => {
  try {
    const res = await getQuestions(categoryId.value, false, null, true)
    allQuestions.value = res.data
  } catch (error) {
    console.error(error)
    allQuestions.value = []
  }
}

const handleToggleFavorite = async (q) => {
  try {
    const res = await toggleFavorite(q.id)
    q.favorite = res.data
  } catch (e) { console.error('收藏操作失败', e) }
}

const handleToggleHidden = async (q) => {
  try {
    const res = await toggleQuestionHidden(q.id)
    q.hidden = res.data
  } catch (e) {
    console.error('切换隐藏状态失败', e)
  }
}

const getQuestionTypeLabel = (type) => {
  if (type === 1) return '单选题'
  if (type === 2) return '多选题'
  if (type === 3) return '判断题'
  return '未知题型'
}

const handleShowAll = async () => {
  try {
    await batchToggleHidden(categoryId.value, 0)
    await loadQuestions()
  } catch (e) { console.error('操作失败', e) }
}

const handleHideAll = async () => {
  if (!confirm('确定要隐藏该科目下所有题目吗？隐藏后它们不会出现在刷题和错题中。')) return
  try {
    await batchToggleHidden(categoryId.value, 1)
    await loadQuestions()
  } catch (e) { console.error('操作失败', e) }
}

onMounted(loadQuestions)
</script>
