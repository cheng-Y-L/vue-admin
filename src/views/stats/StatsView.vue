<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import StatsAnalysis from '@/components/StatsAnalysis.vue'

const auth = useAuthStore()
const { currentUser } = storeToRefs(auth)
</script>

<template>
  <div class="min-h-[70vh]">
    <StatsAnalysis v-if="currentUser" :user="currentUser" />
  </div>
</template>
