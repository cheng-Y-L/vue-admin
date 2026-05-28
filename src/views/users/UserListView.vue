<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import UserList from '@/components/UserList.vue'

const auth = useAuthStore()
const { currentUser } = storeToRefs(auth)
</script>

<template>
  <div v-if="currentUser" class="min-h-[70vh]">
    <UserList :current-user="currentUser" />
  </div>
</template>
