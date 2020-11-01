<template>
  <div id="app">
    <div class="master-upload-container">
      <Simple
        ref="upload"
        :accept="accepts"
        :limit="limit"
        :on-exceed="fileLimitFn"
        :chunk-size="chunkSize"
        :before-upload="beforeUpload"
        :base-url="baseUrl"
        :headers="headers"
        @success="success"
      >
        <div slot="tip" class="upload-tip">
          <i class="el-icon-info"></i>: 只能上传：{{ acceptDesc[uploadType] }}
        </div>
      </Simple>
    </div>
  </div>
</template>

<script>
import Simple from './components/simple'

export default {
  name: 'app',
  components: {
    Simple,
  },
  data() {
    return {
      accepts: '.jpg, .jpeg, .png',
      limit: 20,
      chunkSize: 50 * 1024 * 1024,
      acceptsObj: {
        video: ['video/mp4'],
        image: [
          'image/png',
          'image/gif',
          'image/jpeg',
          'image/jpg',
          'image/bmp',
          '.',
        ], // 火狐的accept只支持【.png,.jpg】这种形式，为了兼容，使用 .
        audio: ['audio/mp3', 'audio/mpeg'],
        ppt: [
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          '.ppt',
          '.pptx',
        ],
        excel: [
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        zip: ['application/x-zip-compressed', '.zip'],
      },
      acceptDesc: {
        video: 'mp4',
        image: 'png,gif,jpeg,jpg,bmp',
        audio: 'mp3',
        ppt: 'ppt',
        excel: 'xls,xlsx',
        zip: 'zip,rar',
      },
      // 临时自测使用
      uploadArguments: {
        type: 'zip',
      },
    }
  },
  created() {
    if (this.uploadType) {
      this.accepts = this.acceptsObj[this.uploadType].join(',')
    } else {
      alert('存在类型不正确的文件')
    }
  },
  methods: {
    // 文件个数限制钩子
    fileLimitFn(file) {
      alert(`最多支持选择${this.limit}个文件`)
    },
    success() {
      this.$message('上传成功')
    },
    beforeUpload(file) {
      console.log('beforeAvatarUpload -> file', file)
      if (this.acceptsObj[this.uploadType].indexOf(file.type) === -1) {
        this.$notify({
          message: '只能上传' + this.acceptDesc[this.uploadType],
          type: 'warning',
          offset: 50,
        })
        return false
      }
      if (!file.size) {
        setTimeout(() => {
          this.$notify({
            message: '不能上传大小为0的文件',
            type: 'warning',
            offset: 50,
          })
        }, 500)
        return false
      }
      return this.propertyRestrictions(file)
    },
    // 属性限制
    async propertyRestrictions(file) {
      let isVerifyResolution
      if (this.uploadType === 'image') {
        isVerifyResolution = await this.verifyResolution(file)
      }
      return new Promise((resolve, reject) => {
        if (this.uploadType === 'image') {
          console.log(
            'propertyRestrictions -> isVerifyResolution',
            isVerifyResolution
          )
          if (!isVerifyResolution) {
            this.$message('messageTips.notAbove4k')
            reject()
          }
        }
        resolve(true)
      })
    },
    // 分辨率校验
    verifyResolution(file, maxWidth = 3840, maxHeight = 2160) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = function() {
          if (reader.readyState === 2) {
            const img = new Image()
            img.src = reader.result
            img.onload = function() {
              const width = this.width
              const height = this.height
              const bool = width > maxWidth || height > maxHeight
              if (bool) {
                resolve(false)
              }
              resolve(true)
            }
          }
        }
      })
    },
  },
  computed: {
    baseUrl() {
      return 'http://localhost:3003/'
    },
    headers() {
      return {
        Authorization: 'token',
      }
    },
    uploadType() {
      return this.uploadArguments.type
    },
  },
}
</script>

<style scoped lang="scss"></style>
