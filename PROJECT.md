# 多维表格标注器 - 项目文档

## 项目概述

飞书多维表格插件，用于在表格右侧面板中逐条查看和编辑记录字段，支持视频/图片预览、代理访问内网资源。

- **仓库**: https://github.com/568681638/bitable-annotator
- **飞书自定义插件**（本地开发）: `http://localhost:5173/`
- **内网部署地址**: `https://dsw-vrip9i7k-8082-ado-euc.k8s.zytintra.com/proxy/6869/`

## 部署方式

### 本地开发
```bash
npm run dev          # Vite 开发服务器 → http://localhost:5173/
npm run build        # 编译到 dist/
```

### 内网服务器部署
服务器路径: `/zyt_users/yuntong.li/server/bitable-annotator/`
```bash
node bitable-annotator-server.mjs &    # 端口 6869
```
服务配置文件: `bitable-annotator.service`（systemd 自动启动、崩溃重启）

---

## 核心功能

### 1. 记录导航
- **上一条/下一条**：切换记录时自动调用 `showFieldValueEditor` 在表格中定位高亮
- **跳转输入框**：输入编号后回车，直接跳转到指定记录
- 显示格式：`[输入框] / 总数`

### 2. 字段渲染
- 支持类型：文本、数字、单选、多选、日期、复选框、URL、公式、附件、人员、群组、位置、自动编号、电话号码、邮箱
- **URL 字段**：自动检测视频/图片/音频类型，渲染为 `<video>` / `<img>` / `<audio>` 标签
- **人员和群组**：显示名称，只读

### 3. 编辑与保存
- 可编辑字段：输入后保存按钮亮起（蓝色）
- **只读字段**：首字段、URL、公式、关联、附件、人员、群组、位置、自动编号
- **撤销按钮**：编辑后出现撤销按钮，点击恢复原始值
- **保存**：调用 `setRecord` 更新到飞书表格

### 4. 刷新按钮
点击刷新按钮 ↻ 同步视图以下变化：
1. 字段元数据（新增/删除/重命名的字段）
2. 视图可见字段顺序
3. 选择字段的选项列表（单选/多选）
4. 记录列表

### 5. 服务端代理（解决 Chrome PNA 限制）
- 代理白名单：只有匹配 `oss-cn-shenzhen-internal.aliyuncs.com` 的内网 OSS URL 才走代理，其他 URL 直连
- 浏览器请求 `/api-proxy/https%3A%2F%2F...` → `bitable-annotator-server.mjs` 代理 → 真实 OSS URL
- 服务端同样有白名单校验，防止被当作开放代理滥用
- 支持 Range 请求（视频流式加载、拖进度条）

---

## 技术决策记录

| 决策 | 原因 |
|------|------|
| 不使用 SDK 表格事件自动刷新 | `RecordModify` 等事件触发太频繁，影响标注体验 |
| 使用手动刷新按钮 | 用户主动控制同步时机 |
| 切换记录时自动定位高亮 | 用 `showFieldValueEditor` 打开首字段编辑框，触发表格定位 |
| 移除 `normalizeOssUrl` | 内网 OSS 地址无对应公网地址，转公网会导致 404 |
| 代理路径用 `api-proxy/`（相对路径） | 避免与 k8s 的 `/proxy/6869/` 路由冲突 |
| 代理加白名单，只代理内网 OSS 域名 | 非 OSS 域名不需要走代理；也防止服务端被当作开放代理 |
| 服务文件名改为 `bitable-annotator-server.mjs` | 避免 pkill 误杀其他 Node 服务 |
| 只用 `RecordAdd` + `RecordDelete` 事件 → 最终改为手动刷新 | 用户反馈自动刷新影响体验 |

---

## SDK 关键 API

| API | 用途 |
|-----|------|
| `bitable.base.getTableById(id)` | 获取表对象 |
| `table.getFieldMetaList()` | 获取所有字段元数据 |
| `view.getVisibleFieldIdList()` | 获取视图可见字段 ID 列表 |
| `table.getRecords({viewId})` | 获取视图记录列表 |
| `field.getOptions()` | 获取单选/多选字段的选项 |
| `table.setRecord(recordId, {fields})` | 保存记录 |
| `bitable.ui.showFieldValueEditor(...)` | 打开字段编辑弹窗（触发表格定位高亮） |
| `bitable.base.onSelectionChange(cb)` | 监听表/视图切换 |
