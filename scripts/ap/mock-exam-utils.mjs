import crypto from 'node:crypto';

export const clean = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();

export function digest(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function normalizedQuestionSignature(question) {
  const options = Array.isArray(question?.optionsJa) ? question.optionsJa.map(clean) : [];
  const subquestions = Array.isArray(question?.subquestions)
    ? question.subquestions.map((item) => ({
        promptJa: clean(item?.promptJa),
        optionsJa: Array.isArray(item?.optionsJa) ? item.optionsJa.map(clean) : [],
      }))
    : [];
  return JSON.stringify({
    promptJa: clean(question?.promptJa),
    passageJa: clean(question?.passageJa),
    optionsJa: options,
    subquestions,
  });
}

export function computeQuestionFingerprint(question) {
  return digest(normalizedQuestionSignature(question));
}

export function roundFiles(round) {
  if (Array.isArray(round?.files)) return round.files.map(clean).filter(Boolean);
  const single = clean(round?.file);
  return single ? [single] : [];
}

export function roundKey(subject, examNo) {
  return `${subject}-${String(examNo).padStart(2, '0')}`;
}
