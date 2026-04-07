const Response = require('../models/Response');

async function buildWholeSurveyStats(surveyId, survey) {
  const responses = await Response.find({ surveyId }).lean();

  const questionStats = survey.questions.map((question) => {
    const relatedAnswers = responses
      .flatMap((response) => response.answers || [])
      .filter((answer) => answer.questionId === question.questionId);

    if (question.type === 'single_choice') {
      const optionCounts = (question.options || []).map((option) => ({
        optionId: option.optionId,
        label: option.label,
        count: relatedAnswers.filter((answer) => answer.value === option.optionId).length
      }));

      return {
        questionId: question.questionId,
        title: question.title,
        type: question.type,
        totalResponses: relatedAnswers.length,
        optionCounts
      };
    }

    if (question.type === 'multi_choice') {
      const optionCounts = (question.options || []).map((option) => ({
        optionId: option.optionId,
        label: option.label,
        count: relatedAnswers.filter(
          (answer) => Array.isArray(answer.value) && answer.value.includes(option.optionId)
        ).length
      }));

      return {
        questionId: question.questionId,
        title: question.title,
        type: question.type,
        totalResponses: relatedAnswers.length,
        optionCounts
      };
    }

    if (question.type === 'number') {
      const numericAnswers = relatedAnswers
        .map((answer) => Number(answer.value))
        .filter((value) => !Number.isNaN(value));

      const average =
        numericAnswers.length > 0
          ? numericAnswers.reduce((sum, value) => sum + value, 0) / numericAnswers.length
          : null;

      return {
        questionId: question.questionId,
        title: question.title,
        type: question.type,
        totalResponses: relatedAnswers.length,
        average,
        allValues: numericAnswers
      };
    }

    return {
      questionId: question.questionId,
      title: question.title,
      type: question.type,
      totalResponses: relatedAnswers.length,
      allValues: relatedAnswers.map((answer) => answer.value)
    };
  });

  return {
    surveyId,
    totalSubmissions: responses.length,
    questionStats
  };
}

function buildSingleQuestionStats(questionStats, questionId) {
  return questionStats.questionStats.find((item) => item.questionId === questionId);
}

module.exports = {
  buildWholeSurveyStats,
  buildSingleQuestionStats
};
