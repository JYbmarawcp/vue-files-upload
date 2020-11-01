import Vue from 'vue'
import App from './App.vue'
// import router from './router'
import store from './store'
import './plugins/element.js'

import global from './utils/global'

Vue.config.productionTip = false
Vue.use(global)

new Vue({
  store,
  render: h => h(App)
}).$mount('#app')
