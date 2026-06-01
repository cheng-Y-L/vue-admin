<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import SystemLogs from '@/components/SystemLogs.vue'

const auth = useAuthStore()
const { currentUser } = storeToRefs(auth)
</script>

<template>
  <div v-if="currentUser" class="min-h-[70vh]">
    <SystemLogs :current-user="currentUser" />
  </div>
</template>
