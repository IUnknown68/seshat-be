//------------------------------------------------------------------------------
function validate(dataset) {
  const errors = [];
  if (!dataset.title) {
    errors.push(new Error('Title missing or empty.'));
  }
  if (!dataset.body) {
    errors.push(new Error('Body missing or empty.'));
  }
  if (!dataset.date) {
    errors.push(new Error('Date missing or empty.'));
  }

  const validated = {
    title: dataset.title,
    body: dataset.body,
    date: dataset.date,
  };

  if (typeof validated.date === 'string' || typeof validated.date === 'number') {
    validated.date = new Date(validated.date);
  }
  if (!(validated.date instanceof Date)) {
    errors.push(new TypeError('Invalid date.'));
  }

  if (errors.length) {
    const err = new Error('Validation errors.');
    err.name = 'ErrorCollection';
    err.errors = errors;
  }

  // Non-failing properties:
  if (dataset.embedding) {
    validated.embedding = dataset.embedding;
  }
  if (dataset.image) {
    validated.image = dataset.image;
  }
  if (dataset.type) {
    validated.type = dataset.type;
  }

  return validated;
}

export default validate;

