# 后台管理系统原型 (Vue 3 + TypeScript)

基于同目录 React 原型迁移的 Vue 3 版本，功能与 UI 保持一致。

## 技术栈

- Vue 3 + TypeScript + Composition API (`<script setup>`)
- Vite 8
- Tailwind CSS 4
- [@lucide/vue](https://lucide.dev) 图标
- localStorage 模拟数据层（与 React 版共用相同 key，可在同端口策略下共享演示数据）

## 功能模块

| 模块 | 说明 |
|------|------|
| 登录/注册 | 演示账号 `admin` / `publisher`，密码任意非空 |
| 驾驶舱首页 | 指标卡片、折线/环图/双柱/漏斗图、快捷下单 |
| 数据统计 | 多维度图表与运营分析 |
| 用户权限 | 角色、权限矩阵、启停账号 |
| 订单管理 | 筛选、发货/妥投/取消、导出 JSON |
| 安全审计 | 日志筛选、模拟威胁、导出/清核 |

## 启动

```bash
cd vue-admin
npm install
npm run dev
```

默认地址：http://localhost:3001

## 构建

```bash
npm run build
npm run preview
```

## 目录结构

```
vue-admin/
├── src/
│   ├── App.vue              # 布局、侧边栏、权限路由
│   ├── components/          # 各业务页面
│   ├── data.ts              # localStorage 数据层
│   ├── types.ts             # TypeScript 类型
│   └── style.css            # Tailwind + 全局样式
└── vite.config.ts
```
