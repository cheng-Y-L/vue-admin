<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import Dashboard from '@/components/Dashboard.vue'

const auth = useAuthStore()
const { currentUser } = storeToRefs(auth)
</script>

<template>
  <Dashboard v-if="currentUser" :user="currentUser" />
</template>
