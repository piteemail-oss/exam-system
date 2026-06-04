<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 顶部导航 -->
    <div class="bg-white shadow-sm p-4">
      <div class="max-w-4xl mx-auto flex justify-between items-center">
        <button @click="handleBack" class="text-gray-600 hover:text-gray-900">
          ← 返回
        </button>
        <div class="flex items-center gap-3">
          <div v-if="isExamMode && examDuration > 0 && !examSubmitted" class="flex items-center gap-2">
            <span class="text-lg font-mono font-bold" :class="examTimeLeft <= 60 ? 'text-red-500' : 'text-gray-700'">{{ formatTime(examTimeLeft) }}</span>
            <button @click="togglePause" class="text-sm px-2 py-1 rounded" :class="examPaused ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'">
              {{ examPaused ? '继续' : '暂停' }}
            </button>
          </div>
          <div class="text-lg font-medium">
            {{ currentIndex + 1 }} / {{ questions.length }}
          </div>
        </div>
        <button v-if="examSubmitted" @click="handleExitExam" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
          退出
        </button>
        <button v-else @click="handleSubmit" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
          交卷
        </button>
      </div>
      <!-- 进度条 -->
      <div class="max-w-4xl mx-auto mt-2">
        <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            class="h-full bg-blue-500 transition-all"
            :style="{ width: `${((currentIndex + 1) / questions.length) * 100}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- 答题卡 -->
    <!-- PC端：左侧固定 -->
    <div class="hidden md:block fixed left-4 top-24 bg-white rounded-xl shadow-sm p-4">
      <div class="text-sm font-medium mb-2">答题卡</div>
      <div class="grid grid-cols-5 gap-2">
        <button
          v-for="(q, index) in questions"
          :key="q.id"
          @click="currentIndex = index"
          class="w-8 h-8 text-xs rounded-lg transition"
          :class="{
            'bg-gray-100': !userAnswers[q.id] && !questionStatus[q.id]?.attempted,
            'bg-blue-500 text-white': questionStatus[q.id]?.attempted && questionStatus[q.id].correct,
            'bg-red-500 text-white': questionStatus[q.id]?.attempted && !questionStatus[q.id].correct,
            'ring-2 ring-blue-300': currentIndex === index
          }"
        >
          {{ index + 1 }}
        </button>
      </div>
    </div>
    <!-- 手机端：可展开答题卡 -->
    <div class="md:hidden fixed bottom-0 left-0 right-0 z-40">
      <div v-if="!showAnswerSheet" class="flex justify-center">
        <button
          @click="showAnswerSheet = true"
          class="px-4 py-2 bg-white shadow-lg rounded-t-xl text-sm text-gray-600"
        >
          答题卡 · {{ questions.length }} 题
        </button>
      </div>
      <div v-else class="bg-white shadow-lg p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-gray-500">答题卡 · {{ questions.length }} 题</span>
          <button @click="showAnswerSheet = false" class="text-gray-400 text-lg leading-none">&times;</button>
        </div>
        <div ref="answerSheetRef" class="grid grid-cols-8 gap-1.5 max-h-60 overflow-y-auto pb-1">
          <button
            v-for="(q, index) in questions"
            :key="q.id"
            :ref="el => { if (el) answerBtns[index] = el }"
            @click="currentIndex = index; showAnswerSheet = false"
            class="h-7 text-xs rounded transition flex items-center justify-center"
            :class="{
              'bg-gray-100 text-gray-700': !userAnswers[q.id] && !questionStatus[q.id]?.attempted,
              'bg-blue-500 text-white': questionStatus[q.id]?.attempted && questionStatus[q.id].correct,
              'bg-red-500 text-white': questionStatus[q.id]?.attempted && !questionStatus[q.id].correct,
              'ring-2 ring-blue-400': currentIndex === index
            }"
          >
            {{ index + 1 }}
          </button>
        </div>
      </div>
    </div>

    <!-- 答题区域 -->
    <div class="max-w-2xl mx-auto p-4 pb-24 md:pb-8 md:p-8" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
      <div v-for="(q, index) in questions" :key="q.id" v-show="currentIndex === index" class="bg-white rounded-xl shadow-sm p-6">
        <!-- 题干 -->
        <div class="text-lg font-medium text-gray-900 mb-2">
          {{ index + 1 }}. {{ q.content }}
        </div>
        <div class="text-sm text-gray-500 mb-6">题型：{{ getQuestionTypeLabel(q.type) }}</div>

        <!-- 闪卡模式 -->
        <template v-if="flashcardEnabled">
          <div v-if="!flipped[q.id]" @click="flipCard(q)" class="mt-4 py-12 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
            <div class="text-4xl mb-2">🃏</div>
            <div class="text-gray-500">点击翻转查看答案</div>
          </div>
          <template v-else>
            <div class="mt-4 p-4 rounded-xl border dark:border-gray-600">
              <div class="text-sm text-gray-500 mb-2">正确答案</div>
              <div v-for="(opt, i) in q.options.filter(o => q.correct_answer?.includes(o.alias))" :key="opt.alias" class="flex items-center gap-2">
                <span class="font-medium">{{ i + 1 }}.</span>
                <span class="text-base dark:text-gray-200">{{ opt.text }}</span>
              </div>
            </div>
            <div v-if="q.analysis" class="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              解析：{{ q.analysis }}
            </div>
            <div class="mt-4 flex gap-3 justify-center flex-wrap">
              <button @click="markForgot()" :disabled="isExamMode && questionStatus[q.id]?.attempted" class="px-8 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed">没记住</button>
              <button @click="markRemembered()" :disabled="isExamMode && questionStatus[q.id]?.attempted" class="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-40 disabled:cursor-not-allowed">记住了</button>
            </div>
          </template>
        </template>

        <!-- 普通模式 -->
        <template v-else>
          <div class="space-y-3">
            <label
              v-for="opt in q.options"
              :key="opt.alias"
              class="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition"
              :class="{
                'border-blue-500 bg-blue-50': isOptionSelected(q, opt.alias) && !questionStatus[q.id]?.attempted,
                'bg-blue-100': questionStatus[q.id]?.attempted && isCorrectOption(q, opt.alias),
                'border-blue-500': questionStatus[q.id]?.attempted && isCorrectOption(q, opt.alias),
                'border-red-500 bg-red-50': questionStatus[q.id]?.attempted && isOptionSelected(q, opt.alias) && !isCorrectOption(q, opt.alias)
              }"
            >
              <input
                :type="q.type === 2 ? 'checkbox' : 'radio'"
                :name="`answer_${q.id}`"
                :value="opt.alias"
                :checked="isOptionSelected(q, opt.alias)"
                :disabled="questionStatus[q.id]?.attempted"
                @change="event => handleOptionChange(q, opt.alias, event.target.checked)"
                class="w-5 h-5 text-blue-600"
              />
              <span class="font-medium w-6">{{ opt.alias }}.</span>
              <span>{{ opt.text }}</span>
            </label>
          </div>

          <div class="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <button
              v-if="!(isExamMode && !isExamFlashcard)"
              @click="handleCheckAnswer(q)"
              :disabled="questionStatus[q.id]?.attempted || !hasSelectedAnswer(q)"
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {{ questionStatus[q.id]?.attempted ? '已确认' : '确认选择' }}
            </button>
            <div class="space-y-3">
              <div v-if="questionStatus[q.id]?.attempted" class="text-sm font-medium" :class="questionStatus[q.id].correct ? 'text-green-600' : 'text-red-600'">
                {{ questionStatus[q.id].correct ? '回答正确' : `回答错误，正确答案：${q.correct_answer}` }}
              </div>
            </div>
          </div>
        </template>

        <!-- 交卷/考试提交后显示解析 -->
        <div v-if="submitted || examSubmitted" class="mt-6 p-4 rounded-lg" :class="userAnswers[q.id] === q.correct_answer ? 'bg-green-50' : 'bg-red-50'">
          <div class="font-medium mb-2">
            {{ userAnswers[q.id] === q.correct_answer ? '✅ 回答正确' : '❌ 回答错误' }}
          </div>
          <div class="text-sm text-gray-600">
            你的答案：{{ userAnswers[q.id] || '未作答' }}<br>
            正确答案：{{ q.correct_answer }}
          </div>
          <div v-if="q.analysis" class="mt-2 text-sm text-gray-700">
            解析：{{ q.analysis }}
          </div>
          <!-- 错题模式下，做对了可以斩题 -->
        </div>
      </div>

      <!-- 底部导航（闪卡模式隐藏） -->
      <div v-if="(!submitted || examSubmitted) && !flashcardEnabled" class="mt-6 flex justify-between">
        <button
          @click="prevQuestion"
          :disabled="currentIndex === 0"
          class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
        >
          上一题
        </button>
        <button
          @click="nextQuestion"
          :disabled="currentIndex === questions.length - 1"
          class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
        >
          下一题
        </button>
      </div>

      <!-- 解析：放在底部导航下方（闪卡模式不重复显示） -->
      <div v-if="!flashcardEnabled" v-for="(q, index) in questions" :key="'a'+q.id" v-show="currentIndex === index">
        <div v-if="(questionStatus[q.id]?.attempted || examSubmitted) && q.analysis" class="mt-4 text-base text-gray-700 bg-gray-50 rounded-lg p-3">
          解析：{{ q.analysis }}
        </div>
      </div>
    </div>

    <!-- 成绩弹窗 -->
    <div v-if="showResult" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-8 w-full max-w-md mx-4 text-center">
        <div class="text-5xl mb-4">🎉</div>
        <h3 class="text-2xl font-bold mb-4">{{ flashcardEnabled ? '背诵完成！' : '考试完成！' }}</h3>
        <div class="text-6xl font-bold text-blue-600 mb-2">{{ result.score.toFixed(1) }}<span class="text-xl">%</span></div>
        <div class="text-gray-500 mb-6">{{ flashcardEnabled ? '记忆率' : '得分 / 满分100' }}</div>
        <div class="text-gray-600 mb-6">
          <template v-if="flashcardEnabled">
            共 {{ result.total }} 题，记住 {{ result.correct }} 题，未记住 {{ result.wrong || (result.total - result.correct) }} 题
          </template>
          <template v-else>
            共 {{ result.total }} 题，做对 {{ result.correct }} 题
          </template>
        </div>
        <button @click="handleBack" class="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
          返回首页
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getQuestions, getWrongQuestions, submitExam, cutWrongQuestion, cutWrongQuestionByQuestionId } from '../api'
import { playCorrectSound, playWrongSound, getSoundEnabled } from '../utils/sound'

const props = defineProps(['categoryId', 'isWrongMode'])
const flashcardEnabled = computed(() => {
  if (isExamMode.value) return isExamFlashcard.value
  return localStorage.getItem('flashcard_' + props.categoryId) === '1'
})
const flipped = ref({})
const flashcardRemembered = ref(0)
const flashcardForgot = ref(0)
const lastMarked = ref(null)
const router = useRouter()
const route = useRoute()

// ==================== 考试模式 ====================
const isExamMode = computed(() => route.query.exam === '1')
const isExamFlashcard = computed(() => route.query.flashcard === '1')
const examDuration = computed(() => parseInt(route.query.duration) || 0)
const examLimit = computed(() => parseInt(route.query.limit) || 0)
const examTimeLeft = ref(0)
const examPaused = ref(false)
let examTimer = null

const examProgressKey = computed(() => `exam_state_${props.categoryId}`)

const saveExamState = () => {
  if (!isExamMode.value || submitted.value) return
  localStorage.setItem(examProgressKey.value, JSON.stringify({
    timeLeft: examTimeLeft.value,
    paused: examPaused.value,
    categoryId: props.categoryId,
    duration: examDuration.value,
    limit: examLimit.value,
    flashcard: isExamFlashcard.value,
    currentIndex: currentIndex.value,
    userAnswers: userAnswers.value,
    questionStatus: questionStatus.value,
    questions: questions.value,
    flipped: flipped.value,
    flashcardRemembered: flashcardRemembered.value,
    flashcardForgot: flashcardForgot.value
  }))
}

const loadExamState = () => {
  try {
    const raw = localStorage.getItem(examProgressKey.value)
    if (!raw) return false
    const state = JSON.parse(raw)
    if (state.categoryId != props.categoryId) return false
    examTimeLeft.value = state.timeLeft || 0
    examPaused.value = state.paused || false
    questions.value = state.questions || []
    currentIndex.value = state.currentIndex || 0
    userAnswers.value = state.userAnswers || {}
    questionStatus.value = state.questionStatus || {}
    flipped.value = state.flipped || {}
    flashcardRemembered.value = state.flashcardRemembered || 0
    flashcardForgot.value = state.flashcardForgot || 0
    if (!examPaused.value && examTimeLeft.value > 0) startTimer()
    return true
  } catch { return false }
}

const clearExamState = () => {
  localStorage.removeItem(examProgressKey.value)
}

const startTimer = () => {
  stopTimer()
  examTimer = setInterval(() => {
    if (examPaused.value) return
    if (examTimeLeft.value <= 0) {
      stopTimer()
      handleFlashcardSubmit()
      return
    }
    examTimeLeft.value--
    if (examTimeLeft.value <= 0) {
      stopTimer()
      handleFlashcardSubmit()
    }
  }, 1000)
}

const stopTimer = () => {
  if (examTimer) { clearInterval(examTimer); examTimer = null }
}

const togglePause = () => {
  examPaused.value = !examPaused.value
  if (!examPaused.value && examTimeLeft.value > 0) startTimer()
  saveExamState()
}

const getExamSubmitData = () => {
  const answers = questions.value
    .filter(q => hasSelectedAnswer(q))
    .map(q => ({
      question_id: q.id,
      user_answer: Array.isArray(userAnswers.value[q.id])
        ? userAnswers.value[q.id].sort().join(',')
        : (userAnswers.value[q.id] || '')
    }))
  return {
    category_id: parseInt(props.categoryId) || 0,
    is_wrong_mode: 0,
    answers
  }
}

const formatTime = (s) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const questions = ref([])
const currentIndex = ref(0)
const lastSavedIndex = ref(0)
const userAnswers = ref({})
const questionStatus = ref({})
const submitted = ref(false)
const showResult = ref(false)
const examSubmitted = ref(false)
const result = ref({})
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchEndX = ref(0)
const touchEndY = ref(0)
const answerSheetRef = ref(null)
const answerBtns = ref({})
const showAnswerSheet = ref(false)

watch(currentIndex, async () => {
  await nextTick()
  const btn = answerBtns.value[currentIndex.value]
  if (btn) {
    btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }
})

const getProgressKey = () => {
  return `exam_progress_${props.categoryId}_${props.isWrongMode ? 'wrong' : 'normal'}`
}

const saveProgress = () => {
  if (submitted.value) return
  try {
    const key = getProgressKey()
    localStorage.setItem(key, JSON.stringify({
      categoryId: props.categoryId,
      isWrongMode: props.isWrongMode ? 1 : 0,
      currentIndex: currentIndex.value,
      userAnswers: userAnswers.value,
      questionStatus: questionStatus.value,
      questions: questions.value,
      flipped: flipped.value
    }))
    localStorage.setItem('exam_progress_last', JSON.stringify({
      categoryId: props.categoryId,
      isWrongMode: props.isWrongMode ? 1 : 0
    }))
  } catch (e) {
    console.warn('保存答题进度失败', e)
  }
}

const loadProgress = () => {
  try {
    const key = getProgressKey()
    const raw = localStorage.getItem(key)
    if (!raw) return false
    const saved = JSON.parse(raw)
    if (saved.categoryId !== props.categoryId || Number(saved.isWrongMode) !== Number(props.isWrongMode ? 1 : 0)) {
      return false
    }
    questions.value = saved.questions || []
    currentIndex.value = saved.currentIndex || 0
    lastSavedIndex.value = saved.currentIndex || 0
    userAnswers.value = saved.userAnswers || {}
    questionStatus.value = saved.questionStatus || {}
    flipped.value = saved.flipped || {}
    return true
  } catch (e) {
    console.warn('读取答题进度失败', e)
    return false
  }
}

const clearProgress = () => {
  try {
    const key = getProgressKey()
    localStorage.removeItem(key)
    localStorage.removeItem('exam_progress_last')
  } catch (e) {
    console.warn('清除答题进度失败', e)
  }
}

const loadQuestions = async () => {
  try {
    // 考试模式：恢复考试状态
    if (isExamMode.value) {
      if (loadExamState()) return
      clearExamState()
    }
    if (props.isWrongMode) {
      clearProgress()
    } else if (!isExamMode.value && loadProgress()) {
      return
    }

    let res
    if (props.isWrongMode) {
      const categoryId = props.categoryId ? parseInt(props.categoryId) : null
      res = await getWrongQuestions(categoryId, true)
      questions.value = res.data.map(wq => ({
        ...wq.question,
        wrongId: wq.id
      }))
    } else {
      const limit = examLimit.value || null
      res = await getQuestions(parseInt(props.categoryId), true, limit)
      questions.value = res.data
    }

    // 考试模式：初始化计时器
    if (isExamMode.value && examDuration.value > 0) {
      examTimeLeft.value = examDuration.value * 60
      startTimer()
    }

    if (questions.value.length === 0) {
      alert('没有题目可做！')
      router.push('/')
    }
  } catch (e) {
    alert('加载题目失败')
    router.push('/')
  }
}

const prevQuestion = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

const nextQuestion = () => {
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
  }
}

const handleTouchStart = (e) => {
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
}

const handleTouchEnd = (e) => {
  touchEndX.value = e.changedTouches[0].clientX
  touchEndY.value = e.changedTouches[0].clientY
  const diffX = touchStartX.value - touchEndX.value
  const diffY = touchStartY.value - touchEndY.value
  // 忽略边缘滑动（浏览器返回手势）
  if (touchStartX.value < 30 || touchStartX.value > window.innerWidth - 30) return
  // 水平滑动距离大于垂直，且超过阈值才触发切换
  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 80) {
    if (diffX > 0) {
      nextQuestion()
    } else {
      prevQuestion()
    }
  }
}

const normalizeAnswer = (answer) => {
  if (Array.isArray(answer)) {
    return answer.map(a => String(a).trim().toUpperCase()).sort().join(',')
  }
  if (!answer) return ''
  return String(answer).split(',').map(a => a.trim().toUpperCase()).filter(Boolean).sort().join(',')
}

const getQuestionTypeLabel = (type) => {
  if (type === 2 || type === '2') return '多选题'
  if (type === 3 || type === '3') return '判断题'
  return '单选题'
}

const isOptionSelected = (q, alias) => {
  const answer = userAnswers.value[q.id]
  if (q.type === 2 || q.type === '2') {
    return Array.isArray(answer) && answer.includes(alias)
  }
  return answer === alias
}

const handleOptionChange = (q, alias, checked) => {
  if (q.type === 2 || q.type === '2') {
    const current = Array.isArray(userAnswers.value[q.id]) ? [...userAnswers.value[q.id]] : []
    if (checked) {
      if (!current.includes(alias)) {
        current.push(alias)
      }
    } else {
      const index = current.indexOf(alias)
      if (index !== -1) {
        current.splice(index, 1)
      }
    }
    userAnswers.value[q.id] = current
  } else {
    userAnswers.value[q.id] = alias
  }
  lastSavedIndex.value = currentIndex.value
  saveProgress()
}

const isCorrectOption = (q, alias) => {
  const correct = normalizeAnswer(q.correct_answer).split(',')
  return correct.includes(alias)
}

const hasSelectedAnswer = (q) => {
  const answer = userAnswers.value[q.id]
  if (q.type === 2 || q.type === '2') {
    return Array.isArray(answer) && answer.length > 0
  }
  return Boolean(answer)
}

const isQuestionAttempted = (q) => {
  return questionStatus.value[q.id]?.attempted
}

const isCurrentAnswerCorrect = (q) => {
  return normalizeAnswer(userAnswers.value[q.id]) === normalizeAnswer(q.correct_answer)
}

const handleCheckAnswer = async (q) => {
  if (isQuestionAttempted(q)) {
    return
  }
  if (!hasSelectedAnswer(q)) {
    alert('请先选择答案后再提交。')
    return
  }
  const correct = isCurrentAnswerCorrect(q)
  questionStatus.value[q.id] = {
    attempted: true,
    correct
  }
  if (getSoundEnabled()) {
    correct ? playCorrectSound() : playWrongSound()
  }
  // 错误答案立即写入错题集（考试模式除外）
  if (!isExamMode.value) {
    if (!correct) {
      const answerStr = Array.isArray(userAnswers.value[q.id])
        ? userAnswers.value[q.id].sort().join(',')
        : userAnswers.value[q.id]
      const data = { category_id: q.category_id || parseInt(props.categoryId) || 0, is_wrong_mode: props.isWrongMode ? 1 : 0, answers: [{ question_id: q.id, user_answer: answerStr }] }
      try { await submitExam(data) } catch {}
    } else {
      try { await cutWrongQuestionByQuestionId(q.id) } catch {}
    }
  }
  lastSavedIndex.value = currentIndex.value
  saveProgress()
}

// 闪卡模式
const flipCard = (q) => {
  flipped.value[q.id] = true
}

const markForgot = async () => {
  const q = questions.value[currentIndex.value]
  if (!q) return
  flashcardForgot.value++
  lastMarked.value = { id: q.id, type: 'forgot' }
  questionStatus.value[q.id] = { attempted: true, correct: false }
  userAnswers.value[q.id] = 'X'
  saveProgress()
  const data = { category_id: q.category_id || parseInt(props.categoryId) || 0, is_wrong_mode: props.isWrongMode ? 1 : 0, answers: [{ question_id: q.id, user_answer: 'WRONG' }] }
  await submitExam(data)
  if (currentIndex.value < questions.value.length - 1) {
    nextQuestion()
  }
}

const markRemembered = async () => {
  const q = questions.value[currentIndex.value]
  if (!q) return
  flashcardRemembered.value++
  lastMarked.value = { id: q.id, type: 'remembered' }
  questionStatus.value[q.id] = { attempted: true, correct: true }
  userAnswers.value[q.id] = q.correct_answer
  saveProgress()
  await cutWrongQuestionByQuestionId(q.id)
  if (currentIndex.value < questions.value.length - 1) {
    nextQuestion()
  }
}

const undoMark = async () => {
  if (!lastMarked.value) return
  const q = questions.value[currentIndex.value]
  if (!q || lastMarked.value.id !== q.id) return
  if (lastMarked.value.type === 'forgot') {
    flashcardForgot.value--
    questionStatus.value[q.id] = { attempted: false, correct: false }
    userAnswers.value[q.id] = ''
    await cutWrongQuestionByQuestionId(q.id)
  } else {
    flashcardRemembered.value--
    questionStatus.value[q.id] = { attempted: false, correct: false }
    userAnswers.value[q.id] = ''
  }
  lastMarked.value = null
  saveProgress()
}

const handleExitExam = () => {
  clearExamState()
  router.push('/')
}

const handleFlashcardSubmit = () => {
  const total = flashcardRemembered.value + flashcardForgot.value
  const rate = total > 0 ? (flashcardRemembered.value / total) * 100 : 0
  result.value = {
    score: rate,
    total,
    correct: flashcardRemembered.value,
    wrong: flashcardForgot.value
  }
  submitted.value = true
  showResult.value = true
  flipped.value = {}
  stopTimer()
  if (isExamMode.value) {
    clearExamState()
  } else {
    clearProgress()
  }
}

const handleKeydown = (e) => {
  // 快捷键
  const key = e.key.toUpperCase()
  const currentQ = questions.value[currentIndex.value]
  if (!currentQ) return

  // A/B/C/D 选择选项
  if (['A', 'B', 'C', 'D'].includes(key)) {
    if (currentQ.type === 2) {
      // 多选，切换
      const answers = userAnswers.value[currentQ.id] || []
      if (answers.includes(key)) {
        userAnswers.value[currentQ.id] = answers.filter(a => a !== key)
      } else {
        userAnswers.value[currentQ.id] = [...answers, key]
      }
    } else {
      // 单选/判断
      userAnswers.value[currentQ.id] = [key]
    }
    saveProgress()
  }

  // 方向键切换
  if (e.key === 'ArrowLeft') {
    prevQuestion()
  }
  if (e.key === 'ArrowRight') {
    nextQuestion()
  }

  // Enter下一题
  if (e.key === 'Enter') {
    nextQuestion()
  }
}

const getCorrectWrongQuestionIds = () => {
  return questions.value
    .filter(q => q.wrongId && hasSelectedAnswer(q) && normalizeAnswer(userAnswers.value[q.id]) === normalizeAnswer(q.correct_answer))
    .map(q => q.wrongId)
}

const getCorrectQuestionIds = () => {
  const result = questions.value
    .filter(q => {
      const hasAnswer = hasSelectedAnswer(q)
      const userNorm = normalizeAnswer(userAnswers.value[q.id])
      const correctNorm = normalizeAnswer(q.correct_answer)
      const match = userNorm === correctNorm
      if (hasAnswer) {
        console.log('[getCorrectQuestionIds] q.id:', q.id, 'type:', q.type, 'userAnswer:', userAnswers.value[q.id], 'correctAnswer:', q.correct_answer, 'userNorm:', userNorm, 'correctNorm:', correctNorm, 'match:', match)
      }
      return hasAnswer && match
    })
    .map(q => q.id)
  console.log('[getCorrectQuestionIds] 结果:', result)
  return result
}

const cleanupCorrectWrongQuestions = async () => {
  const correctWrongIds = getCorrectWrongQuestionIds()
  const correctQuestionIds = props.isWrongMode ? [] : getCorrectQuestionIds()
  console.log('[cleanup] isWrongMode:', props.isWrongMode, 'correctWrongIds:', correctWrongIds, 'correctQuestionIds:', correctQuestionIds)
  if (!correctWrongIds.length && !correctQuestionIds.length) {
    console.log('[cleanup] 没有需要清理的错题，跳过')
    return
  }
  try {
    const results = await Promise.all([
      ...correctWrongIds.map(id => cutWrongQuestion(id).then(r => ({ type: 'wrongId', id, res: r.data }))),
      ...correctQuestionIds.map(id => cutWrongQuestionByQuestionId(id).then(r => ({ type: 'questionId', id, res: r.data })))
    ])
    console.log('[cleanup] 清理结果:', JSON.stringify(results))
  } catch (e) {
    console.warn('退出考试时删除已答对错题失败', e)
  }
}

const handleSubmit = async () => {
  if (flashcardEnabled.value) {
    stopTimer()
    handleFlashcardSubmit()
    return
  }
  if (isExamMode.value) {
    stopTimer()
    // 考试模式：先不退出，展示答案供浏览
    if (!isExamFlashcard.value) {
      // 普通考试模式：提交后仍可浏览
      try { await submitExam({...getExamSubmitData()}) } catch {}
      examSubmitted.value = true
      // 标记所有已回答的题为 attempted
      for (const q of questions.value) {
        if (hasSelectedAnswer(q) && !questionStatus.value[q.id]?.attempted) {
          const correct = normalizeAnswer(userAnswers.value[q.id]) === normalizeAnswer(q.correct_answer)
          questionStatus.value[q.id] = { attempted: true, correct }
        }
      }
      saveExamState()
      return
    }
    clearExamState()
  }
  // 检查未答题
  const unanswered = questions.value.filter(q => !hasSelectedAnswer(q))
  if (unanswered.length > 0) {
    if (!confirm(`还有 ${unanswered.length} 道题未作答，确定要交卷吗？`)) {
      return
    }
  }

  // 构造提交数据，只包含已作答题目
  const answers = questions.value
    .filter(q => hasSelectedAnswer(q))
    .map(q => ({
      question_id: q.id,
      user_answer: Array.isArray(userAnswers.value[q.id])
        ? userAnswers.value[q.id].sort().join(',')
        : (userAnswers.value[q.id] || '')
    }))

  try {
    const res = await submitExam({
      category_id: props.categoryId ? parseInt(props.categoryId) : 0,
      is_wrong_mode: props.isWrongMode ? 1 : 0,
      answers: answers
    })

    await cleanupCorrectWrongQuestions()

    clearProgress()
    submitted.value = true
    result.value = res.data
    showResult.value = true
  } catch (e) {
    alert('提交失败')
  }
}

const handleCutQuestion = async (wrongId) => {
  await cutWrongQuestion(wrongId)
  alert('斩题成功！该题已从错题本移除')
  // 从列表中移除
  questions.value = questions.value.filter(q => q.wrongId !== wrongId)
  // 如果当前题被删了，回到上一题
  if (currentIndex.value >= questions.value.length) {
    currentIndex.value = Math.max(0, questions.value.length - 1)
  }
}

const handleBack = async () => {
  if (examSubmitted.value) {
    handleExitExam()
    return
  }
  if (isExamMode.value) {
    saveExamState()
    stopTimer()
    router.push('/')
    return
  }
  saveProgress()
  await cleanupCorrectWrongQuestions()
  router.push('/')
}

onMounted(() => {
  loadQuestions()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(async () => {
  document.removeEventListener('keydown', handleKeydown)
  stopTimer()
  if (isExamMode.value) {
    if (!submitted.value) saveExamState()
  } else {
    saveProgress()
    await cleanupCorrectWrongQuestions()
  }
})
</script>
