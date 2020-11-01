// 所有文件状态
export const Status = {
  wait: 'wait',
  pause: 'pause',
  uploading: 'uploading',
  hash: 'hash',
  error: 'error',
  done: 'done'
}

// 单个文件的状态 对应描述
export const fileStatus = {
  wait: {
    code: 'wait',
    name: '待上传'
  },
  uploading: {
    code: 'uploading',
    name: '上传中'
  },
  success: {
    code: 'success',
    name: '成功'
  },
  error: {
    code: 'error',
    name: '失败'
  },
  secondPass: {
    code: 'secondPass',
    name: '已秒传'
  },
  pause: {
    code: 'pause',
    name: '暂停'
  },
  resume: {
    code: 'resume',
    name: '恢复'
  }
}