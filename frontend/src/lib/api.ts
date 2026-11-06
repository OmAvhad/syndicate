import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'https://syndicate-backend-n3p9.onrender.com'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('world-id-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('world-id-token')
      localStorage.removeItem('world-id-user')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export default api
