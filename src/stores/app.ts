import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const isSidebarOpen = ref(true)
  const currentTime = ref('')

  let timeInterval: ReturnType<typeof setInterval> | undefined

  function startClock() {
    const updateTime = () => {
      currentTime.value = new Date().toLocaleString('zh-CN', { hour12: false })
    }
    updateTime()
    timeInterval = setInterval(updateTime, 1000)
  }

  function stopClock() {
    if (timeInterval) {
      clearInterval(timeInterval)
      timeInterval = undefined
    }
  }

  function toggleSidebar() {
    isSidebarOpen.value = !isSidebarOpen.value
  }

  function closeSidebarOnMobile() {
    if (window.innerWidth < 1024) isSidebarOpen.value = false
  }

  return {
    isSidebarOpen,
    currentTime,
    startClock,
    stopClock,
    toggleSidebar,
    closeSidebarOnMobile,
  }
})
