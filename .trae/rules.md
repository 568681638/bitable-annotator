# Trae IDE Rules

## 项目文档

在回答任何与项目功能、技术决策、部署相关的问题前，先阅读 `PROJECT.md` 了解项目背景。

## 重要约定

1. 不要立即编译和 git 推送代码，先开 `npm run dev` 让用户测试，用户确认通过后再编译和推送
2. 功能变更后，同步更新 `PROJECT.md`
3. 回答问题时优先引用项目文件路径，使用 `file:///d:/trae/feishu/bitable-annotator/...` 格式的链接

## 项目结构

```
src/index.ts       - 插件主逻辑
index.html         - 插件 HTML 模板
index.scss          - 样式
bitable-annotator-server.mjs  - Node.js 后端代理服务器
bitable-annotator.service     - systemd 服务配置
PROJECT.md          - 项目文档
dist/              - 编译产物
```
