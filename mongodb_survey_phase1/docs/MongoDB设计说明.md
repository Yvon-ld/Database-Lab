# MongoDB 设计说明

## 一、集合划分

### 1. users
用于保存注册用户账号信息。
字段：
- `_id`
- `username`
- `passwordHash`
- `createdAt`
- `updatedAt`

### 2. surveys
用于保存问卷主体、题目定义、校验规则、跳转规则、问卷状态。
字段：
- `_id`
- `ownerId`
- `title`
- `description`
- `slug`
- `status`
- `settings`
- `version`
- `questionOrder`
- `questions`
- `publishedAt`
- `closedAt`
- `createdAt`
- `updatedAt`

### 3. responses
用于保存填写结果。
字段：
- `_id`
- `surveyId`
- `surveyTitleSnapshot`
- `surveyVersion`
- `respondentId`
- `respondentType`
- `visitedQuestionIds`
- `answers`
- `submittedAt`
- `createdAt`
- `updatedAt`

## 二、为什么不把所有数据放一个集合
如果把用户、问卷、回答都塞到一个集合，会带来：
1. 文档职责不清晰
2. 写入与查询逻辑复杂
3. 问卷回答会无限增长，不适合继续嵌入 Survey 文档
4. 统计时难以高效筛选
5. 第二阶段扩展会非常痛苦

因此拆成三个集合更合理。

## 三、为什么 Survey 里嵌入 questions，而不是 questions 单独建集合
因为题目与问卷是强聚合关系：
- 一次填写问卷时，通常要把整份问卷一起读出来
- 题目数量通常有限
- 题目配置（校验、跳转）和问卷本体强绑定
- 嵌入后读取一份问卷只需要一次查询

因此，`questions` 适合嵌入 `surveys` 文档中。

## 四、为什么 Response 单独建集合
因为问卷提交次数可能很多：
- 如果把所有回答嵌入 Survey，会导致 Survey 文档不断膨胀
- MongoDB 单文档有 16MB 限制
- 多人同时提交时，写入同一文档会增加冲突
- 统计时把 Response 分开更适合做聚合

所以 Response 必须拆开。

## 五、为什么适合 MongoDB
问卷系统的特点：
1. 题型不同，字段要求不同
2. 不同题目有不同校验规则
3. 不同题目有不同跳转条件
4. 第二阶段需求变化大

MongoDB 的文档模型更适合：
- 一个 Survey 直接保存题目数组
- 每个题目可带不同 validation
- 每个题目可带不同 jumpRules
- 结构扩展灵活，迭代成本低
