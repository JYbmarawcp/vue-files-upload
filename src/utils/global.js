import * as utils from './common'

export default {
  install(Vue) {
    Vue.prototype.$utils = utils
  }
}