# 基于 MongoDB 的问卷系统（课程大作业）

## 1. 项目简介
本项目是一个基于 **Node.js + Express + MongoDB + EJS** 实现的在线问卷系统，面向《数据库管理系统》课程大作业要求进行开发。系统支持用户注册登录、问卷创建与编辑、问卷发布与关闭、匿名/登录填写、条件跳转、答案校验、提交保存以及统计查看。

项目实现重点不在复杂前端，而在于：
- MongoDB 数据结构设计
- 问卷题目与规则的业务建模
- 条件跳转与访问路径控制
- 提交校验与统计逻辑实现
- 为后续需求变更保留扩展空间

当前版本已经完成一个可运行的问卷系统，并在基础版本上补充了若干交互与提交流程修正，使功能与课程要求更加一致。

---

## 2. 已实现功能

### 2.1 用户与权限
- 用户注册
- 用户登录 / 退出登录
- 密码加密存储（不保存明文密码）
- 登录后仅可查看和管理自己创建的问卷
- 登录失败时显示错误提示信息

### 2.2 问卷管理
- 创建问卷
- 编辑问卷
- 查看“我的问卷”列表
- 发布问卷
- 关闭问卷
- 设置问卷截止时间
- 自动生成可访问链接（slug）
- 首页展示问卷当前状态、是否允许匿名、提交次数、版本号

### 2.3 题目类型
系统支持以下 4 类题目：
- 单选题（single_choice）
- 多选题（multi_choice）
- 文本填空题（text）
- 数字填空题（number）

### 2.4 校验能力
- 必答校验
- 单选答案合法性校验
- 多选答案合法性校验
- 多选最少选择数校验
- 多选最多选择数校验
- 多选必须恰好选择数校验
- 文本最短长度校验
- 文本最大长度校验
- 数字范围校验
- 数字整数限制校验
- 前端即时校验 + 后端统一校验
- 多选题页面显示选择数量提示

### 2.5 条件跳转
支持将跳转规则作为问卷数据配置，而不是写死在程序里。

当前支持：
- 单选题按某个选项跳转
- 多选题“包含任意一个选项”跳转
- 多选题“同时包含多个选项”跳转
- 数字题按 >、>=、<、<= 跳转
- 数字题按区间跳转
- 默认跳转（always）
- 跳转到其他题目
- 直接跳转到提交页（`__SUBMIT__`）

### 2.6 填写与提交
- 通过问卷链接填写
- 支持匿名填写或登录后填写（由问卷设置决定）
- 支持允许/禁止重复提交（由问卷设置决定）
- 登录用户重复提交限制
- 匿名访客重复提交限制（基于 session）
- 根据用户回答动态计算实际访问题目路径
- 只校验用户真正访问过的题目
- 完成后显示提交前摘要页
- 成功提交后保存答案与访问路径

### 2.7 统计分析
- 查看整卷统计
- 查看单题统计
- 单选题统计各选项被选择次数
- 多选题统计各选项被选择次数
- 文本题查看全部填写内容
- 数字题查看全部填写值并计算平均值

---

## 3. 技术栈
- **后端框架**：Express
- **数据库**：MongoDB + Mongoose
- **模板引擎**：EJS
- **会话管理**：express-session + connect-mongo
- **密码加密**：bcryptjs
- **运行环境**：Node.js

---

## 4. 项目目录结构
```text
mongodb_survey_phase1/
├── src/
│   ├── app.js
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   └── surveyController.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Survey.js
│   │   └── Response.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── pageRoutes.js
│   │   └── surveyRoutes.js
│   ├── services/
│   │   ├── surveyBuilderService.js
│   │   ├── validationService.js
│   │   ├── jumpService.js
│   │   └── statsService.js
│   └── utils/
│       └── slug.js
├── views/
├── public/
├── docs/
├── examples/
├── .env.example
├── compose.yaml
├── package.json
└── README.md
```

---

## 5. MongoDB 数据设计概览
系统主要使用 3 个核心集合：

### 5.1 users
保存注册用户信息。
主要字段：
- `username`
- `passwordHash`
- `createdAt`
- `updatedAt`

### 5.2 surveys
保存问卷本体、题目结构、校验规则、跳转规则与设置。
主要字段：
- `ownerId`
- `title`
- `description`
- `slug`
- `status`
- `settings.allowAnonymous`
- `settings.allowMultipleSubmissions`
- `settings.deadlineAt`
- `version`
- `questionOrder`
- `questions[]`
- `publishedAt`
- `closedAt`

### 5.3 responses
保存用户每次提交结果。
主要字段：
- `surveyId`
- `surveyTitleSnapshot`
- `surveyVersion`
- `respondentId`
- `respondentType`
- `visitedQuestionIds`
- `answers[]`
- `submittedAt`

---

## 6. 运行方式

### 6.1 环境要求
- Node.js 18+（建议）
- MongoDB

### 6.2 安装依赖
```bash
npm install
```

### 6.3 配置环境变量
将 `.env.example` 复制为 `.env`：

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/mongodb_survey_system
SESSION_SECRET=replace_with_your_session_secret
```

### 6.4 启动 MongoDB
确保本地 MongoDB 服务已启动。

也可以使用 Docker 启动：
```bash
docker compose up -d
```

### 6.5 启动项目
```bash
npm run dev
```

启动成功后访问：
```text
http://localhost:3000
```

---

## 7. 基本使用流程
1. 注册账号并登录
2. 进入“新建问卷”页面
3. 填写问卷标题、说明、截止时间等信息
4. 添加题目并配置选项 / 校验规则 / 跳转规则
5. 保存问卷
6. 在“我的问卷”中发布问卷
7. 复制问卷链接给填写者
8. 填写并提交问卷
9. 创建者查看整卷统计和单题统计

---

## 8. 当前实现中的关键设计

### 8.1 跳转规则数据化
跳转条件保存在 `questions[].jumpRules` 中，提交和填写时统一按规则计算，不把业务逻辑写死在控制器中，便于后续扩展。

### 8.2 校验前后端分层
- 前端负责即时提示，提高填写体验
- 后端负责最终校验，保证数据安全与一致性

### 8.3 访问路径落库
每次提交会额外保存 `visitedQuestionIds`，这样统计和调试时能知道用户实际走过哪条问卷路径，也能避免未访问题目参与校验。

### 8.4 重复提交控制
- 登录用户：通过 `surveyId + respondentId` 检查
- 匿名用户：通过 session 中的已提交问卷列表进行限制

---

## 9. 说明与限制
- 当前系统以课程项目为目标，前端采用服务端渲染页面 + 表单提交方式。
- 当前“API”主要是项目内部页面路由和表单接口，不是独立对外的 REST JSON 平台。
- 匿名用户重复提交限制基于 session，若更换浏览器或清理会话后可再次提交；这是课程项目阶段可接受的实现方式。
- 统计页面当前以文本与数字方式展示，未引入图表库。

---

## 10. 后续可扩展方向
- 增加删除问卷 / 复制问卷功能
- 增加问卷分页、搜索与筛选
- 增加图表化统计展示
- 增加更细粒度的权限控制
- 增加问卷导出功能
- 增加第二阶段需求中的结构扩展与兼容迁移逻辑

---

## 11. 文档位置
- `docs/系统说明.md`
- `docs/MongoDB设计说明.md`
- `docs/API说明.md`
- `docs/关键逻辑说明.md`
- `测试用例.md`
- `2026_ECNU_PJ1_1_第1组.pdf`
