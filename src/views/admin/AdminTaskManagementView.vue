<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import AdminTaskManagement from '@/components/AdminTaskManagement.vue'

const auth = useAuthStore()
const { currentUser } = storeToRefs(auth)
</script>

<template>
  <div v-if="currentUser" class="min-h-[70vh]">
    <AdminTaskManagement :current-user="currentUser" />
  </div>
</template>
