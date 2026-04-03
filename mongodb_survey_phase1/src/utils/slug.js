function generateSurveySlug() {
  const random = Math.random().toString(36).slice(2, 10);
  return `survey-${random}`;
}

module.exports = {
  generateSurveySlug
};
