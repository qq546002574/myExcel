<template>
  <div class="data-table">
    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="供应商数据" name="datas">
        <div class="search-area">
          <el-form :inline="true" :model="searchForm">
            <el-form-item label="厂商">
              <el-select 
                v-model="searchForm.vendor" 
                placeholder="请选择厂商"
                multiple
                clearable>
                <el-option
                  v-for="item in vendorOptions"
                  :key="item"
                  :label="item"
                  :value="item">
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="名称">
              <el-input
                v-model="searchForm.name"
                placeholder="请输入名称"
                clearable>
              </el-input>
            </el-form-item>
            <el-form-item label="料号">
              <el-input
                v-model="searchForm.materialNo"
                placeholder="请输入料号"
                clearable>
              </el-input>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSearch">查询</el-button>
              <el-button @click="handleReset">重置</el-button>
            </el-form-item>
          </el-form>
        </div>
        
        <div class="table-operations">
          <el-button @click="handleAdd" type="primary">新增</el-button>
          <el-button @click="exportData" type="primary">导出Excel</el-button>
          <el-button @click="triggerImport" type="primary">导入Excel</el-button>
          <input
            type="file"
            ref="fileInput"
            style="display: none"
            accept=".xlsx, .xls"
            @change="importData"
          >
        </div>

        <vxe-table
          :data="tableData"
          :height="400"
          border
          show-header
          show-overflow>
          <vxe-column
            v-for="col in tableColumns"
            :key="col.field"
            :field="col.field"
            :title="col.title">
          </vxe-column>
          <vxe-column title="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button
                @click="handleEdit(row)"
                type="text"
                size="small">
                编辑
              </el-button>
              <el-button
                @click="handleDelete(row)"
                type="text"
                size="small"
                style="color: #F56C6C">
                删除
              </el-button>
            </template>
          </vxe-column>
        </vxe-table>
      </el-tab-pane>
      
      <el-tab-pane label="供应商数据分析" name="analysis">
        <div class="chart-container">
          <div ref="defectChart" class="chart"></div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="最高不良率的物料品种排序柱状图" name="echart">
        <div class="chart-container">
          <div ref="materialDefectChart" class="chart"></div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 对话框保持不变 -->
    <el-dialog :title="dialogTitle" :visible.sync="dialogVisible" width="50%">
      <el-form
        ref="form"
        :model="formData"
        label-width="120px">
        <el-form-item
          v-for="col in tableColumns"
          :key="col.field"
          :label="col.title">
          <el-input v-model="formData[col.field]" v-if="col.field !== '厂家'"></el-input>
          <el-select
            v-else
            v-model="formData[col.field]"
            placeholder="请选择厂家"
            filterable
            allow-create
            default-first-option>
            <el-option
              v-for="item in vendorOptions"
              :key="item"
              :label="item"
              :value="item">
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="handleSave">确 定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import * as echarts from 'echarts'

export default {
  name: 'DataTable',
  data() {
    return {
      activeTab: 'datas',
      tableData: [],
      tableColumns: [],
      dialogVisible: false,
      dialogTitle: '',
      formData: {},
      editingIndex: -1,
      searchForm: {
        vendor: '',
        name: '',
        materialNo: ''
      },
      originalTableData: [],
      vendorOptions: [],
      chart: null
    }
  },
  watch: {
    activeTab(newVal) {
      if (newVal === 'analysis' || newVal === 'echart') {
        this.$nextTick(() => {
          this.initChart()
          this.initMaterialChart()
        })
      }
    },
    tableData: {
      handler() {
        if (this.activeTab === 'analysis' || this.activeTab === 'echart') {
          this.updateChart()
          this.updateMaterialChart()
        }
      },
      deep: true
    }
  },
  methods: {
    // 导出Excel
    exportData() {
      const worksheet = XLSX.utils.json_to_sheet(this.tableData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, '供应商数据')
      
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      saveAs(blob, `供应商数据${new Date().toLocaleDateString()}.xlsx`)
    },
    handleReset(){
      this.searchForm = {
        vendor: '',
        name: '',
        materialNo: ''
      }
      this.tableData = [...this.originalTableData]
    },
    // 导入Excel
    importData(event) {
      const file = event.target.files[0]
      if (!file) return

      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          
          const worksheet = workbook.Sheets[workbook.SheetNames[0]]
          
          // 获取表头信息
          const range = XLSX.utils.decode_range(worksheet['!ref'])
          const headers = []
          
          // 读取第一行作为表头
          for(let C = range.s.c; C <= range.e.c; ++C) {
            const cell = worksheet[XLSX.utils.encode_cell({r:0, c:C})]
            headers.push(cell ? cell.v : '')
          }
          
          // 设置表格列
          this.tableColumns = headers.filter(Boolean).map(header => ({
            field: header,
            title: header
          }))

          // 转换数据
          const jsonData = XLSX.utils.sheet_to_json(worksheet)
          
          // 即使没有数据也保留表头
          this.tableData = jsonData
          this.originalTableData = [...jsonData]
          
          // 更新厂商选项（如果有数据的话）
          const vendors = new Set(jsonData.map(item => item['厂家']).filter(Boolean))
          this.vendorOptions = Array.from(vendors)

          if (jsonData.length === 0) {
            this.$message.warning('Excel文件中没有数据，但已加载表头！')
          } else {
            this.$message.success('数据导入成功！')
          }
        } catch (error) {
          console.error('导入失败：', error)
          this.$message.error('导入失败，请检查文件格式是否正确！')
        }
      }

      reader.readAsArrayBuffer(file)
      event.target.value = ''
    },

    // 触发导入文件选择
    triggerImport() {
      this.$refs.fileInput.click()
    },

    // 新增按钮点击
    handleAdd() {
      this.dialogTitle = '新增数据'
      // 根据当前表格列创建空的表单数据
      this.formData = this.tableColumns.reduce((acc, col) => {
        acc[col.field] = ''
        return acc
      }, {})
      this.editingIndex = -1
      this.dialogVisible = true
    },

    // 编辑按钮点击
    handleEdit(row) {
      this.dialogTitle = '编辑数据'
      this.formData = { ...row }
      this.editingIndex = this.tableData.indexOf(row)
      this.dialogVisible = true
    },

    // 删除按钮点击
    handleDelete(row) {
      this.$confirm('确认删除该条数据吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        const index = this.tableData.indexOf(row)
        this.tableData.splice(index, 1)
        this.$message.success('删除成功')
      }).catch(() => {
        this.$message.info('已取消删除')
      })
    },

    // 保存数据
    handleSave() {
      if (this.editingIndex > -1) {
        this.$set(this.tableData, this.editingIndex, { ...this.formData })
        const originalIndex = this.originalTableData.findIndex(item => 
          item === this.tableData[this.editingIndex]
        )
        if (originalIndex > -1) {
          this.$set(this.originalTableData, originalIndex, { ...this.formData })
        }
      } else {
        this.tableData.push({ ...this.formData })
        this.originalTableData.push({ ...this.formData })
      }
      this.updateVendorOptions()
      this.dialogVisible = false
      this.$message.success(this.editingIndex > -1 ? '修改成功' : '添加成功')
    },

    // 处理查询
    handleSearch() {
      if (!this.searchForm.vendor.length && !this.searchForm.name.length && !this.searchForm.materialNo.length) {
        this.tableData = [...this.originalTableData]
        return
      }
      const filteredData = this.originalTableData.filter(item => {
        const matchVendor = this.searchForm.vendor.includes(item['厂家'])
        
        const matchName = this.searchForm.name.includes(item['名称'])
        
        const matchMaterialNo = this.searchForm.materialNo.includes(item['料号'])
        
        return matchVendor || matchName || matchMaterialNo
      })
      
      this.tableData = filteredData
      
      if (filteredData.length === 0) {
        this.$message.warning('未找到匹配的数据')
      }
    },

    // 更新厂商选项
    updateVendorOptions() {
      const vendors = new Set(this.originalTableData.map(item => item.vendor).filter(Boolean))
      this.vendorOptions = Array.from(vendors)
    },

    initChart() {
      if (this.chart) {
        this.chart.dispose()
      }
      this.chart = echarts.init(this.$refs.defectChart)
      this.updateChart()
    },

    updateChart() {
      if (!this.chart) return

      // 处理数据
      const vendorData = {}
      this.tableData.forEach(item => {
        if (!vendorData[item['厂家']]) {
          vendorData[item['厂家']] = []
        }
        // 将不良率转换为数字
        const rate = parseFloat(item['不良率']) || 0
        vendorData[item['厂家']].push(rate)
      })

      // 计算每个厂商的平均不良率
      const vendors = Object.keys(vendorData)
      const avgDefectRates = vendors.map(vendor => {
        const rates = vendorData[vendor]
        const avg = rates.reduce((a, b) => a + b, 0) / rates.length
        return {
          vendor,
          rate: parseFloat(avg.toFixed(2))
        }
      })

      // 按不良率排序
      avgDefectRates.sort((a, b) => b.rate - a.rate)

      const option = {
        title: {
          text: '供应商不良率分析',
          left: 'center'
        },
        tooltip: {
          trigger: 'axis',
          formatter: '{b}: {c}%'
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: avgDefectRates.map(item => item.vendor),
          axisLabel: {
            interval: 0,
            rotate: 45
          }
        },
        yAxis: {
          type: 'value',
          name: '不良率(%)',
          axisLabel: {
            formatter: '{value}%'
          }
        },
        series: [
          {
            name: '不良率',
            type: 'line',
            data: avgDefectRates.map(item => item.rate),
            markLine: {
              data: [
                {
                  type: 'average',
                  name: '平均值'
                }
              ]
            },
            label: {
              show: true,
              position: 'top',
              formatter: '{c}%'
            },
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            itemStyle: {
              color: '#409EFF'
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: 'rgba(64,158,255,0.3)'
                },
                {
                  offset: 1,
                  color: 'rgba(64,158,255,0.1)'
                }
              ])
            }
          }
        ]
      }

      this.chart.setOption(option)
    },

    initMaterialChart() {
      if (this.chart) {
        this.chart.dispose()
      }
      this.chart = echarts.init(this.$refs.materialDefectChart)
      this.updateMaterialChart()
    },

    updateMaterialChart() {
      if (!this.chart) return

      // 处理数据：按物料分组并计算不良率
      const materialData = this.tableData.reduce((acc, item) => {
        const key = `${item['料号']}-${item['名称']}`
        if (!acc[key]) {
          acc[key] = {
            vendor: item['厂家'],
            batch: item['批次'],
            defectReason: item['来料不良(IQC)5%质量问题'] || item['产线不良生产线'] || '',
            defectRate: parseFloat(item['不良率']) || 0,
            materialNo: item['料号'],
            name: item['名称']
          }
        } else {
          // 如果同一物料有多条记录，取最高不良率
          const currentRate = parseFloat(item['不良率']) || 0
          if (currentRate > acc[key].defectRate) {
            acc[key].defectRate = currentRate
          }
        }
        return acc
      }, {})

      // 转换为数组并排序，取前20个
      const sortedData = Object.values(materialData)
        .sort((a, b) => b.defectRate - a.defectRate)
        .slice(0, 20)

      const option = {
        title: {
          text: '物料不良率TOP20排序',
          left: 'center'
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'line'
          },
          formatter: function(params) {
            const data = params[0]
            return `厂家：${sortedData[data.dataIndex].vendor}<br/>
                    批次：${sortedData[data.dataIndex].batch}<br/>
                    料号：${sortedData[data.dataIndex].materialNo}<br/>
                    ${sortedData[data.dataIndex].defectReason}<br/>
                    名称：${sortedData[data.dataIndex].name}<br/>
                    不良率：${data.value}`
          }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '15%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: sortedData.map(item => item.materialNo),
          axisLabel: {
            interval: 0,
            rotate: 45,
            formatter: function(value) {
              return value.length > 10 ? value.substring(0, 10) + '...' : value
            }
          }
        },
        yAxis: {
          type: 'value',
          name: '不良率',
          axisLabel: {
            formatter: '{value}'
          }
        },
        series: [
          {
            name: '不良率',
            type: 'line',
            data: sortedData.map(item => item.defectRate),
            label: {
              show: true,
              position: 'top',
              formatter: '{c}'
            },
            // 折线图样式设置
            smooth: true, // 平滑曲线
            symbol: 'circle', // 数据点样式
            symbolSize: 8, // 数据点大小
            itemStyle: {
              color: '#409EFF' // 线条颜色
            },
            lineStyle: {
              width: 3 // 线条宽度
            },
            areaStyle: { // 区域填充样式
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: 'rgba(64,158,255,0.3)'
                },
                {
                  offset: 1,
                  color: 'rgba(64,158,255,0.1)'
                }
              ])
            },
            markLine: {
              data: [
                {
                  type: 'average',
                  name: '平均值',
                  label: {
                    formatter: '平均值: {c}'
                  }
                }
              ]
            }
          }
        ]
      }

      this.chart.setOption(option)
    }
  },
  mounted() {
    window.addEventListener('resize', () => {
      if (this.chart) {
        this.chart.resize()
      }
    })
  },
  beforeDestroy() {
    if (this.chart) {
      this.chart.dispose()
      this.chart = null
    }
    window.removeEventListener('resize', this.handleResize)
  }
}
</script>

<style lang="less" scoped>
.data-table {
  padding: 20px;
  height: 100%;
  
  .el-tabs {
    background-color: #fff;
    padding: 20px;
    border-radius: 4px;
    
    ::v-deep .el-tabs__content {
      padding: 20px 0;
    }
  }

  .search-area {
    margin-bottom: 16px;
    background-color: #fff;
    padding: 16px;
    border-radius: 4px;

    .el-form-item {
      margin-bottom: 10px;
      
      .el-input {
        width: 200px;
      }
      
      .el-select {
        width: 200px;
      }
    }
  }

  .table-operations {
    margin-bottom: 16px;
    
    .el-button + .el-button {
      margin-left: 10px;
    }
  }

  .vxe-table {
    background-color: #fff;
    border-radius: 4px;
  }

  .chart-container {
    background-color: #fff;
    padding: 20px;
    border-radius: 4px;
    
    .chart {
      width: 100%;
      height: 500px;
    }
  }
}
</style> 