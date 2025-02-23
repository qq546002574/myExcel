const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  css: {
    loaderOptions: {
      less: {
        lessOptions: {
          // 如果要配置全局变量，可以在这里添加
          // javascriptEnabled: true,
          // modifyVars: {
          //   'primary-color': '#1DA57A',
          // }
        }
      }
    }
  }
})
