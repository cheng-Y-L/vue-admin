<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import ContentManagement from '@/components/ContentManagement.vue'

const auth = useAuthStore()
const { currentUser } = storeToRefs(auth)
</script>

<template>
  <div v-if="currentUser" class="min-h-[70vh]">
    <ContentManagement :current-user="currentUser" />
  </div>
</template>
