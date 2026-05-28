<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import TaskDetail from '@/components/TaskDetail.vue'

const auth = useAuthStore()
const { currentUser } = storeToRefs(auth)
</script>

<template>
  <div v-if="currentUser" class="min-h-[70vh]">
    <TaskDetail :current-user="currentUser" />
  </div>
</template>
