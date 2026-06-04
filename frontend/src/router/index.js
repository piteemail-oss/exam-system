import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import QuestionEdit from '../views/QuestionEdit.vue'
import Exam from '../views/Exam.vue'
import WrongQuestions from '../views/WrongQuestions.vue'
import Settings from '../views/Settings.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/category/:id/questions',
    name: 'QuestionList',
    component: QuestionEdit
  },
  {
    path: '/exam/:categoryId',
    name: 'Exam',
    component: Exam,
    props: route => ({ isWrongMode: false, ...route.params })
  },
  {
    path: '/wrong-exam/:categoryId?',
    name: 'WrongExam',
    component: Exam,
    props: route => ({ isWrongMode: true, ...route.params })
  },
  {
    path: '/category/:categoryId/wrong-questions',
    name: 'WrongQuestions',
    component: WrongQuestions,
    props: true
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
