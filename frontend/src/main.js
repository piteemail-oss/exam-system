import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'

// 初始化夜间模式
if (localStorage.getItem('dark_mode') === '1') {
  document.documentElement.classList.add('dark')
}

const app = createApp(App)
app.use(router)
app.mount('#app')
