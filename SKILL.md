# Todo List 工具创建 Skill

## 概述
创建一个功能完整的 Todo List（待办事项）管理工具，支持前端单页应用和可选的 Python Flask 后端。

## 触发条件
- 用户要求创建一个待办事项/任务管理应用
- 用户需要 Todo List 的完整实现方案
- 需要从前端到后端的全栈 Todo 工具
- 一个新文件夹

## 项目结构

```
Todo_list/
├── todo.html                  # 独立前端单页应用（可直接浏览器打开使用）
├── pytodo/                    # 可选 Python Flask 后端
│   ├── run.py                 # 启动入口
│   ├── requirements.txt       # Python 依赖
│   ├── setup.py               # 包安装配置
│   └── pytodo/
│       ├── app.py             # Flask 应用工厂
│       ├── config.py          # 配置管理（开发/生产环境）
│       ├── db.py              # 数据库初始化与操作
│       ├── auth/              # 用户认证模块
│       │   └── views.py       # 登录/注册 API
│       ├── tasks/             # 任务管理模块
│       │   └── views.py       # 任务 CRUD API
│       ├── share/             # 分享功能模块
│       │   └── views.py       # 分享链接 API
│       ├── templates/
│       │   └── index.html     # 前端模板
│       └── static/            # 静态资源
└── README.md
```

## 功能模块分解

### 模块 1 — 用户认证 (Authentication)
- **注册**：用户名 + 密码，本地存储（localStorage）或后端数据库
- **登录**：密码哈希验证，Session 管理
- **跳过登录**：游客模式，无需注册即可使用
- **退出登录**：清除会话，恢复初始状态

### 模块 2 — 任务 CRUD (Task Management)
- **创建任务**：任务名称（必填）、状态、开始时间、截止时间、备注
- **编辑任务**：点击编辑按钮，弹窗修改所有字段
- **删除任务**：确认后删除，不可恢复
- **任务状态**：未开始 / 进行中 / 已完成（三态流转）

### 模块 3 — 筛选与排序 (Filter & Sort)
- **筛选**：全部 / 未开始 / 进行中 / 已完成
- **排序**：
  - 按截止时间 ↑/↓
  - 按创建时间 ↑/↓
  - 按状态排序
- **统计栏**：显示各状态任务数量

### 模块 4 — 时间与进度追踪 (Progress Tracking)
- **开始/截止时间**：datetime-local 输入
- **进度条**：基于当前时间与开始-截止区间计算百分比
- **超期提醒**：超过截止时间的任务红色标记
- **即将到期**：24 小时内到期的任务黄色标记

### 模块 5 — 分享与协作 (Share & Collaborate)
- **生成分享链接**：将任务数据 base64 编码写入 URL hash
- **复制链接**：一键复制到剪贴板
- **导入分享链接**：从 URL 或编码字符串导入他人任务列表
- **共享模式标识**：绿色提示条标明当前为共享列表模式

### 模块 6 — 导入/导出 (Import & Export)
- **导出 JSON**：下载任务数据为 `.json` 文件备份
- **导入 JSON**：右键导出按钮或通过文件选择器导入备份
- **URL 同步**：监听 `hashchange` 事件，支持浏览器前进/后退

### 模块 7 — Python 后端（可选）
- **Flask 应用工厂**：配置驱动的应用创建
- **数据库层**：SQLite/PostgreSQL 支持
- **REST API**：
  - `POST /api/auth/login` — 登录
  - `POST /api/auth/register` — 注册
  - `GET/POST /api/tasks` — 任务列表/创建
  - `PUT/DELETE /api/tasks/<id>` — 更新/删除任务
  - `GET /api/share/<code>` — 获取分享数据

## 数据模型

```javascript
// 任务对象
{
  id: Number,           // 唯一标识（时间戳）
  title: String,        // 任务名称（必填，≤200字符）
  status: String,       // "not-started" | "in-progress" | "completed"
  startTime: String,    // ISO datetime 或 null
  deadline: String,     // ISO datetime 或 null
  notes: String,        // 备注（≤500字符）
  createdAt: String     // ISO datetime
}
```

## 关键技术实现

### 前端（todo.html — 纯 HTML/CSS/JS 单文件）
- **存储方案**：`localStorage` 按用户隔离数据
- **密码处理**：客户端哈希（`hashPassword` 函数）
- **URL 编解码**：`TextEncoder/TextDecoder` + `btoa/atob` 实现 Unicode-safe base64
- **防抖更新**：URL hash 更新使用 300ms 防抖
- **状态管理**：全局 `todos` 数组 + `render()` 驱动视图

### 后端（pytodo/ — Flask + SQLAlchemy）
- **ORM**：SQLAlchemy 管理数据模型
- **蓝图**：模块化路由注册
- **环境配置**：`PYTODO_ENV` 环境变量切换开发/生产配置
- **迁移**：数据库自动初始化

## 验收标准

每个功能模块的验收标准：

| 模块 | Given | When | Then |
|------|-------|------|------|
| 注册 | 用户名不存在 | 输入用户名+密码，点击注册 | 注册成功，自动登录 |
| 登录 | 已注册用户 | 输入正确凭据，点击登录 | 进入主页面，加载任务 |
| 创建任务 | 在主页面 | 点击新建，填写表单，保存 | 任务出现在列表中 |
| 编辑任务 | 任务存在 | 点击编辑，修改字段，保存 | 任务信息更新 |
| 删除任务 | 任务存在 | 点击删除，确认 | 任务从列表移除 |
| 筛选 | 存在不同状态任务 | 点击筛选按钮 | 仅显示对应状态任务 |
| 排序 | 存在多个任务 | 切换排序方式 | 列表按规则重新排列 |
| 分享 | 存在任务 | 点击复制分享链接 | 链接复制到剪贴板 |
| 导入 | 有分享链接 | 粘贴链接，点击导入 | 任务列表被导入数据替换 |
| 导出 | 存在任务 | 点击导出 JSON | 下载 JSON 文件 |

## 检查清单
- [ ] 无后端依赖时，todo.html 可直接在浏览器中使用
- [ ] 用户名和密码有基本校验（长度限制）
- [ ] 所有用户操作有 Toast 反馈
- [ ] 空状态有友好提示
- [ ] 模态框支持 ESC 关闭和点击遮罩关闭
- [ ] URL 编码支持 Unicode 字符（中文等）
- [ ] 共享模式下数据同步到 URL hash
- [ ] 响应式布局适配不同屏幕尺寸
