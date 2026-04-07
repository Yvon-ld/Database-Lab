# 基于 MongoDB 的问卷系统（第二阶段）

## 1. 项目简介
本项目是一个基于 **Node.js + Express + MongoDB + EJS** 的在线问卷系统，面向《数据库管理系统》课程大作业开发。

第一阶段完成了问卷创建、发布、填写、条件跳转、答案校验和统计分析。  
第二阶段根据需求变更，进一步实现了：

- 可复用题目库
- 题目共享
- 题目版本链
- 已发布问卷题目快照锁定
- 题目跨问卷统计

系统重点不在复杂前端，而在于：

- MongoDB 文档模型设计
- 题目复用与版本化建模
- 问卷题目快照与历史一致性保护
- 条件跳转与访问路径控制
- 提交校验与统计逻辑实现

---

## 2. 第二阶段新增能力

### 2.1 题目独立化
- 题目不再只嵌在问卷中
- 支持单独创建题目并保存到题库
- 一个题目可被多个问卷复用

### 2.2 题目共享
- 题目拥有者可按用户名共享题目根版本
- 被共享用户可在自己的问卷中导入这些题目

### 2.3 题目版本化
- 支持基于已有题目创建新版本
- 支持查看某题目的版本历史
- 支持查看当前版本的父版本关系

### 2.4 已发布问卷保护
- 问卷中保存题目快照
- 已发布/已关闭问卷不可再编辑
- 导入到问卷中的题库题目会显示“来源版本已锁定”
- 后续修改题目不会污染旧问卷

### 2.5 题库管理
- 支持创建题库（Question Library）
- 支持将题目加入题库
- 问卷编辑页可从题库/可访问版本列表导入题目

### 2.6 跨问卷统计
- 支持在题目详情页查看某个题目根版本在所有问卷中的总体回答统计
- 响应记录会保存：
  - `sourceQuestionId`
  - `sourceQuestionRootId`
  - `sourceQuestionVersion`

---

## 3. 已实现功能概览

### 3.1 用户与权限
- 用户注册
- 用户登录 / 退出登录
- 密码加密存储
- 仅允许登录用户管理自己的问卷与题库

### 3.2 问卷管理
- 创建问卷
- 编辑草稿问卷
- 发布问卷
- 关闭问卷
- 设置截止时间
- 自动生成可访问链接（slug）
- 查看“我的问卷”列表和提交次数

### 3.3 题目类型
- 单选题 `single_choice`
- 多选题 `multi_choice`
- 文本题 `text`
- 数字题 `number`

### 3.4 校验能力
- 必答校验
- 单选/多选合法性校验
- 多选最少/最多/恰好选择数校验
- 文本最短/最长长度校验
- 数字范围校验
- 数字整数限制校验
- 前端即时校验 + 后端统一校验

### 3.5 条件跳转
当前支持以下跳转规则：

- `single_equals`
- `multi_contains_any`
- `multi_contains_all`
- `number_gt`
- `number_gte`
- `number_lt`
- `number_lte`
- `number_between`
- `always`

可跳转到：

- 某个题目
- `__SUBMIT__` 提交页

### 3.6 填写与提交
- 登录/匿名填写
- 可配置是否允许重复提交
- 登录用户按 `surveyId + respondentId` 限制重复提交
- 匿名用户基于 session 限制重复提交
- 根据回答动态计算真实访问路径
- 只校验真正访问过的题目
- 保存 `visitedQuestionIds`

### 3.7 统计分析
- 整卷统计
- 单题统计
- 题目跨问卷统计
- 单选/多选计数
- 文本答案列表
- 数字答案平均值

---

## 4. 技术栈
- 后端框架：Express
- 数据库：MongoDB + Mongoose
- 模板引擎：EJS
- 会话管理：express-session + connect-mongo
- 密码加密：bcryptjs
- 前端：原生 JavaScript + CSS
- 运行环境：Node.js

---

## 5. 目录结构
```text
mongodb_survey_phase1/
├── src/
│   ├── app.js
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── surveyController.js
│   │   └── questionController.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Survey.js
│   │   ├── Response.js
│   │   ├── Question.js
│   │   └── QuestionLibrary.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── pageRoutes.js
│   │   ├── surveyRoutes.js
│   │   └── questionRoutes.js
│   ├── services/
│   │   ├── surveyBuilderService.js
│   │   ├── questionBuilderService.js
│   │   ├── questionCatalogService.js
│   │   ├── validationService.js
│   │   ├── jumpService.js
│   │   └── statsService.js
│   └── utils/
│       └── slug.js
├── public/
│   ├── css/style.css
│   └── js/
│       ├── builder.js
│       ├── fillSurvey.js
│       └── questionEditor.js
├── views/
│   ├── auth/
│   ├── partials/
│   ├── questions/
│   ├── stats/
│   └── surveys/
├── docs/
├── examples/
├── compose.yaml
├── package.json
└── README.md
```

---

## 6. 数据模型

### 6.1 users
保存注册用户信息：

- `username`
- `passwordHash`
- `createdAt`
- `updatedAt`

### 6.2 questions
保存独立题目版本：

- `ownerId`
- `rootQuestionId`
- `parentQuestionId`
- `version`
- `visibility`
- `sharedWithUserIds`
- `title`
- `description`
- `type`
- `required`
- `options`
- `validation`

### 6.3 questionlibraries
保存题库分组：

- `ownerId`
- `name`
- `description`
- `questionRootIds`

### 6.4 surveys
保存问卷本体及题目快照：

- `ownerId`
- `title`
- `description`
- `slug`
- `status`
- `settings`
- `version`
- `questionOrder`
- `questions[]`
  - `questionId`
  - `sourceQuestionId`
  - `sourceQuestionRootId`
  - `sourceQuestionVersion`
  - `sourceLocked`
  - `title`
  - `options`
  - `validation`
  - `jumpRules`
- `publishedAt`
- `closedAt`

### 6.5 responses
保存问卷提交结果：

- `surveyId`
- `surveyTitleSnapshot`
- `surveyVersion`
- `respondentId`
- `respondentType`
- `visitedQuestionIds`
- `answers[]`
  - `questionId`
  - `sourceQuestionId`
  - `sourceQuestionRootId`
  - `sourceQuestionVersion`
  - `questionTitleSnapshot`
  - `questionType`
  - `value`
- `submittedAt`

---

## 7. 运行方式

### 7.1 环境要求
- Node.js 18+
- MongoDB

### 7.2 安装依赖
```bash
npm install
```

### 7.3 配置环境变量
将 `.env.example` 复制为 `.env`：

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/mongodb_survey_system
SESSION_SECRET=replace_with_your_session_secret
```

### 7.4 启动 MongoDB
本地启动 MongoDB，或使用 Docker：

```bash
docker compose up -d
```

### 7.5 启动项目
```bash
npm run dev
```

启动后访问：

```text
http://localhost:3000
```

---

## 8. 主要页面与路由

### 8.1 页面入口
- `/dashboard` 我的问卷
- `/questions` 题库首页
- `/questions/new` 新建题目
- `/surveys/new` 新建问卷
- `/survey/:slug` 填写问卷

### 8.2 题库相关路由
- `GET /questions`
- `GET /questions/new`
- `POST /questions`
- `GET /questions/:id`
- `GET /questions/:id/new-version`
- `POST /questions/:id/versions`
- `POST /questions/:id/share`
- `POST /questions/libraries`
- `POST /questions/libraries/:libraryId/questions`
- `POST /questions/libraries/:libraryId/questions/:rootQuestionId/remove`

### 8.3 问卷相关路由
- `GET /surveys/new`
- `POST /surveys`
- `GET /surveys/:id/edit`
- `POST /surveys/:id`
- `POST /surveys/:id/publish`
- `POST /surveys/:id/close`
- `GET /surveys/:id/stats`
- `GET /surveys/:id/stats/:questionId`
- `GET /survey/:slug`
- `POST /survey/:slug/submit`

---

## 9. 基本使用流程

### 9.1 使用题库构建问卷
1. 注册并登录
2. 进入“Question Bank”
3. 创建题目
4. 如有需要，创建新版本或共享给其他用户
5. 创建题库并将题目加入题库
6. 进入“New Survey”
7. 从右侧题库/版本列表导入题目，或添加自定义题目
8. 保存问卷并发布
9. 通过 slug 链接填写问卷
10. 在问卷统计页和题目详情页查看结果

### 9.2 版本保护规则
1. 题目在题库中可继续迭代新版本
2. 问卷导入时会记录所用版本
3. 已发布问卷不可再编辑
4. 旧问卷仍保留旧版本题目内容

---

## 10. 验证情况

### 10.1 已完成启动验证
已完成一轮真实启动验证，结论如下：

- 服务可正常启动
- MongoDB 可正常连接
- 用户注册/登录可用
- 题目创建可用
- 题库创建与加题可用
- 题目新版本创建可用
- 问卷创建、发布、填写、统计可用
- 响应中能正确保存题目根版本与具体版本

### 10.2 已完成浏览器级手工检查
已完成一轮 Playwright 驱动的浏览器检查，确认以下行为：

- 注册页可正常使用
- 登录后导航正常
- 题库页和题目创建页可正常打开
- 题目详情页可正常展示版本和统计区域
- 问卷构建页右侧可展示可导入题目版本
- 导入题库题后，页面会明确标记“来源版本已锁定”
- 导入题的定义字段会变为只读，只保留问卷级跳题规则可编辑

### 10.3 最终验证结论
本轮已完成针对关键问题的修复与回归验证，当前已验证通过的核心链路包括：

- 浏览器端创建自定义问卷并保存成功
- 问卷保存后能够正确跳转到编辑页并落库
- 导入题库题后，导入题定义字段被正确锁定
- 已发布问卷重新打开编辑页时，页面进入只读锁定状态
- 发布后编辑页会显示锁定提示，并隐藏保存按钮

最终浏览器验证样例：

- 浏览器保存问卷成功创建：
  - `Final Verification Survey`
- 发布后锁定验证通过：
  - `Final Publish Lock Survey`
  - 编辑页状态：
    - `hasLockAlert = true`
    - `saveButtonExists = false`
    - `titleDisabled = true`

---

## 11. 说明与限制
- 当前项目采用服务端渲染页面 + 表单提交，不是独立 REST API 平台
- 匿名重复提交限制基于 session，更换浏览器或清理会话后可再次提交
- 统计展示目前以文本和数字为主，未引入图表库
- 共享能力当前按用户名共享，不支持更细粒度的角色与组织权限

---

## 12. 后续可扩展方向
- 增加“恢复到旧版本”操作
- 增加问卷删除/复制
- 增加题库搜索与筛选
- 增加图表化统计展示
- 增加问卷导出
- 增加更细粒度的共享与协作权限

---

## 13. 相关文档
- `docs/系统说明.md`
- `docs/MongoDB设计说明.md`
- `docs/API说明.md`
- `docs/关键逻辑说明.md`
- `测试用例.md`
- `测试用例第二阶段.md`
