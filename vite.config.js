import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Konfigurasi 'base' penting agar file bisa dimuat dengan benar
  base: './', 
})