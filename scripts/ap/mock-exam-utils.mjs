import crypto from 'node:crypto';

export const clean = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();

export function digest(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizedTable(table) {
  return {
    titleJa: clean(table?.titleJa ?? table?.title_ja),
    headers: Array.isArray(table?.headers) ? table.headers.map(clean) : [],
    rows: Array.isArray(table?.rows)
      ? table.rows.map((row) => Array.isArray(row) ? row.map(clean) : [clean(row)])
      : [],
  };
}

function normalizedSubquestion(item) {
  return {
    key: clean(item?.key),
    promptJa: clean(item?.promptJa ?? item?.prompt_ja),
    optionsJa: Array.isArray(item?.optionsJa) ? item.optionsJa.map(clean) : [],
  };
}

export function normalizedQuestionSignature(question) {
  const content = question?.content && typeof question.content === 'object' ? question.content : {};
  const subquestions = Array.isArray(content?.subquestions)
    ? content.subquestions.map(normalizedSubquestion)
    : Array.isArray(question?.subquestions)
      ? question.subquestions.map(normalizedSubquestion)
      : [];
  const logs = Array.isArray(content?.logs)
    ? content.logs.map((item) => clean(typeof item === 'string' ? item : JSON.stringify(item)))
    : [];
  const tables = Array.isArray(content?.tables) ? content.tables.map(normalizedTable) : [];
  return JSON.stringify({
    promptJa: clean(question?.promptJa),
    passageJa: clean(content?.passageJa ?? content?.passage_ja ?? question?.passageJa),
    optionsJa: Array.isArray(question?.optionsJa) ? question.optionsJa.map(clean) : [],
    logs,
    tables,
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
