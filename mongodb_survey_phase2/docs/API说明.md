# API 说明（按当前项目实际实现更新）

## 1. 说明
本项目当前采用 **EJS 服务端渲染 + HTML 表单提交** 的实现方式，因此这里的“API”既包含页面访问路由，也包含表单提交接口。

返回结果分为两类：
- 页面渲染（HTML）
- 提交后重定向 / 提示页

如果老师查看接口文档，建议明确说明：
> 本项目不是纯前后端分离系统，因此接口说明以“页面路由 + 表单接口 + 核心请求参数”为主。

---

## 2. 认证模块

### 2.1 注册页
- **URL**：`GET /auth/register`
- **说明**：进入注册页面
- **权限**：未登录用户
- **返回**：注册页面

### 2.2 注册提交
- **URL**：`POST /auth/register`
- **说明**：创建新用户并自动登录
- **权限**：未登录用户
- **请求参数（form）**：

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| username | string | 是 | 用户名 |
| password | string | 是 | 登录密码，长度至少 6 位 |

- **成功结果**：
  - 写入 `users` 集合
  - session 保存 `userId`
  - 重定向到 `/dashboard`
- **失败情况**：
  - 用户名为空
  - 密码为空
  - 密码长度不足
  - 用户名已存在

### 2.3 登录页
- **URL**：`GET /auth/login`
- **说明**：进入登录页面
- **权限**：未登录用户
- **返回**：登录页面

### 2.4 登录提交
- **URL**：`POST /auth/login`
- **说明**：校验用户身份并登录
- **权限**：未登录用户
- **请求参数（form）**：

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| username | string | 是 | 用户名 |
| password | string | 是 | 登录密码 |

- **成功结果**：
  - session 保存 `userId`
  - 重定向到 `/dashboard`
- **失败结果**：
  - 显示“用户名或密码错误”等提示信息

### 2.5 退出登录
- **URL**：`POST /auth/logout`
- **说明**：清除 session，退出登录
- **权限**：已登录用户
- **成功结果**：重定向到 `/auth/login`

---

## 3. 页面入口与首页路由

### 3.1 首页
- **URL**：`GET /`
- **说明**：
  - 已登录：跳转到 `/dashboard`
  - 未登录：跳转到 `/login`（再重定向到 `/auth/login`）

### 3.2 仪表盘 / 我的问卷
- **URL**：`GET /dashboard`
- **说明**：查看当前登录用户创建的所有问卷
- **权限**：已登录用户
- **返回内容**：
  - 问卷标题
  - 问卷状态
  - 问卷链接
  - 是否允许匿名
  - 提交次数
  - 版本号

---

## 4. 问卷管理模块

### 4.1 创建问卷页面
- **URL**：`GET /surveys/new`
- **说明**：进入问卷创建页面
- **权限**：已登录用户

### 4.2 创建问卷提交
- **URL**：`POST /surveys`
- **说明**：保存新问卷
- **权限**：已登录用户
- **请求参数（form）**：

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| builderPayload | string(JSON) | 是 | 问卷结构 JSON 字符串 |

#### builderPayload 结构示例
```json
{
  "title": "学生信息调查",
  "description": "用于收集基础信息",
  "settings": {
    "allowAnonymous": true,
    "allowMultipleSubmissions": false,
    "deadlineAt": "2026-04-10T23:59"
  },
  "questions": [
    {
      "questionId": "question-1",
      "title": "你的性别",
      "description": "请选择一个选项",
      "type": "single_choice",
      "required": true,
      "options": [
        { "optionId": "option-a", "label": "男" },
        { "optionId": "option-b", "label": "女" }
      ],
      "validation": {
        "text": {},
        "number": {},
        "multi": {}
      },
      "jumpRules": []
    }
  ]
}
```

- **后端处理流程**：
  1. 解析 `builderPayload`
  2. 清洗与补全字段
  3. 自动生成 slug
  4. 校验问卷标题和题目合法性
  5. 保存到 `surveys` 集合

- **成功结果**：重定向到 `/surveys/:id/edit`
- **失败情况**：
  - 问卷标题为空
  - 没有题目
  - 单选/多选题少于两个选项
  - JSON 结构错误

### 4.3 编辑问卷页面
- **URL**：`GET /surveys/:id/edit`
- **说明**：打开已存在问卷进行编辑
- **权限**：问卷创建者

### 4.4 编辑问卷提交
- **URL**：`POST /surveys/:id`
- **说明**：更新问卷内容
- **权限**：问卷创建者
- **请求参数（form）**：

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| builderPayload | string(JSON) | 是 | 修改后的问卷结构 |

- **更新内容**：
  - `title`
  - `description`
  - `settings`
  - `questions`
  - `questionOrder`
  - `version` 自动加 1

### 4.5 发布问卷
- **URL**：`POST /surveys/:id/publish`
- **说明**：将问卷状态改为 `published`
- **权限**：问卷创建者
- **成功结果**：
  - `status = published`
  - 写入 `publishedAt`

### 4.6 关闭问卷
- **URL**：`POST /surveys/:id/close`
- **说明**：将问卷状态改为 `closed`
- **权限**：问卷创建者
- **成功结果**：
  - `status = closed`
  - 写入 `closedAt`

---

## 5. 问卷填写模块

当前项目里存在两组填写路由：
- 对外展示推荐使用：`/survey/:slug`
- 兼容填写路由：`/surveys/fill/:slug`

### 5.1 访问问卷（推荐入口）
- **URL**：`GET /survey/:slug`
- **说明**：通过公开链接进入问卷填写页
- **权限**：
  - 若 `allowAnonymous=true`：任何用户可填写
  - 若 `allowAnonymous=false`：需登录

- **访问前置检查**：
  - 问卷是否存在
  - 问卷是否已发布
  - 问卷是否已关闭
  - 是否超过截止时间
  - 是否允许匿名填写

### 5.2 访问问卷（兼容入口）
- **URL**：`GET /surveys/fill/:slug`
- **说明**：功能与 `/survey/:slug` 一致

### 5.3 提交问卷（推荐入口）
- **URL**：`POST /survey/:slug/submit`
- **说明**：提交填写结果
- **请求参数（form）**：

| 参数名 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| answersPayload | string(JSON) | 是 | 答案 JSON 字符串 |

#### answersPayload 示例
```json
{
  "question-1": "option-a",
  "question-2": ["option-x", "option-y"],
  "question-3": "我喜欢这门课",
  "question-4": "18"
}
```

### 5.4 提交问卷（兼容入口）
- **URL**：`POST /surveys/fill/:slug/submit`
- **说明**：功能与 `/survey/:slug/submit` 一致

### 5.5 提交流程说明
提交时后端会执行以下处理：
1. 根据 slug 查找问卷
2. 检查问卷状态、截止时间和登录要求
3. 检查是否允许重复提交
4. 解析 `answersPayload`
5. 根据跳转规则计算实际访问过的题目 `visitedQuestionIds`
6. 仅校验访问过的题目答案
7. 写入 `responses` 集合
8. 返回成功提示页

### 5.6 重复提交限制规则
当 `allowMultipleSubmissions=false` 时：

- **登录用户**：
  - 按 `surveyId + respondentId` 检查是否已提交

- **匿名用户**：
  - 按 session 中的 `anonymousSubmittedSurveyIds` 检查

### 5.7 失败情况
- 问卷不存在
- 问卷未发布 / 已关闭 / 已过截止时间
- 未登录却尝试填写不允许匿名的问卷
- 重复提交受限
- 必答题未填
- 多选题数量不合法
- 文本长度不合法
- 数字不合法或超范围

---

## 6. 统计模块

### 6.1 查看整卷统计
- **URL**：`GET /surveys/:id/stats`
- **说明**：查看问卷整体统计结果
- **权限**：问卷创建者
- **返回内容**：
  - 总提交数
  - 每道题的统计信息

### 6.2 查看单题统计
- **URL**：`GET /surveys/:id/stats/:questionId`
- **说明**：查看某一道题的详细统计
- **权限**：问卷创建者

### 6.3 当前统计规则
- **单选题**：统计每个选项被选次数
- **多选题**：统计每个选项被包含次数
- **文本题**：展示全部填写内容
- **数字题**：展示全部填写值，并计算平均值

---

## 7. 主要数据结构说明

### 7.1 Survey.questions[]
```json
{
  "questionId": "question-1",
  "title": "你的年龄",
  "description": "请输入整数",
  "type": "number",
  "required": true,
  "order": 1,
  "options": [],
  "validation": {
    "text": {},
    "number": {
      "min": 0,
      "max": 120,
      "integerOnly": true
    },
    "multi": {}
  },
  "jumpRules": [
    {
      "priority": 1,
      "ruleType": "number_gte",
      "value": 18,
      "targetQuestionId": "question-2"
    }
  ]
}
```

### 7.2 Response.answers[]
```json
{
  "questionId": "question-1",
  "questionType": "number",
  "value": 18
}
```

---

## 8. 跳转规则类型总表

| ruleType | 适用题型 | 含义 |
|---|---|---|
| single_equals | 单选题 | 等于某个选项时跳转 |
| multi_contains_any | 多选题 | 包含任意一个选项时跳转 |
| multi_contains_all | 多选题 | 同时包含多个选项时跳转 |
| number_gt | 数字题 | 大于某个值时跳转 |
| number_gte | 数字题 | 大于等于某个值时跳转 |
| number_lt | 数字题 | 小于某个值时跳转 |
| number_lte | 数字题 | 小于等于某个值时跳转 |
| number_between | 数字题 | 在某个区间内时跳转 |
| always | 任意题型 | 当前面规则都不匹配时的默认跳转 |


