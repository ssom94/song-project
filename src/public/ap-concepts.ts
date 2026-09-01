interface ConceptRow {
  id: number; concept_code: string; exam_part: string; unit_ko: string; unit_ja: string;
  title_ko: string; title_ja: string; definition_ko: string; definition_ja: string;
  principle_ko: string; principle_ja: string; key_points_ko: string; key_points_ja: string;
  method_ko: string; method_ja: string; traps_ko: string; traps_ja: string;
  memory_ko: string; memory_ja: string; example_ko: string; example_ja: string; sort_order: number;
}
interface TypeRow { id:number; type_no:number; type_name_ko:string; type_name_ja:string; sort_order:number; }
interface QuestionRow {
  id:number; problem_type_id:number; question_no:number; question_ko:string; question_ja:string;
  choices_ko_json:string|null; choices_ja_json:string|null; correct_choice:number|null;
  answer_ko:string; answer_ja:string; explanation_ko:string; explanation_ja:string; difficulty:number; sort_order:number;
}
function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'public, max-age=300' } });
}
function parseChoices(value: string | null): string[] {
  if (!value) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
}
function mapConcept(row: ConceptRow) {
  return {
    code: row.concept_code, examPart: row.exam_part, unitKo: row.unit_ko, unitJa: row.unit_ja,
    titleKo: row.title_ko, titleJa: row.title_ja, sortOrder: row.sort_order,
    sections: {
      definition: { ko: row.definition_ko, ja: row.definition_ja },
      principle: { ko: row.principle_ko, ja: row.principle_ja },
      keyPoints: { ko: row.key_points_ko, ja: row.key_points_ja },
      method: { ko: row.method_ko, ja: row.method_ja },
      traps: { ko: row.traps_ko, ja: row.traps_ja },
      memory: { ko: row.memory_ko, ja: row.memory_ja },
      example: { ko: row.example_ko, ja: row.example_ja },
    },
  };
}
export async function handleGetPublicApConcepts(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const code = (url.searchParams.get('code') || '').trim().toUpperCase();
    if (!code) {
      const result = await env.song_project_db.prepare(`
        SELECT id, concept_code, exam_part, unit_ko, unit_ja, title_ko, title_ja,
          definition_ko, definition_ja, principle_ko, principle_ja, key_points_ko, key_points_ja,
          method_ko, method_ja, traps_ko, traps_ja, memory_ko, memory_ja, example_ko, example_ja, sort_order
        FROM ap_concepts WHERE is_published=1 ORDER BY sort_order ASC
      `).all<ConceptRow>();
      return json({ ok:true, concepts: result.results.map(mapConcept) });
    }
    const row = await env.song_project_db.prepare(`
      SELECT id, concept_code, exam_part, unit_ko, unit_ja, title_ko, title_ja,
        definition_ko, definition_ja, principle_ko, principle_ja, key_points_ko, key_points_ja,
        method_ko, method_ja, traps_ko, traps_ja, memory_ko, memory_ja, example_ko, example_ja, sort_order
      FROM ap_concepts WHERE concept_code=?1 AND is_published=1 LIMIT 1
    `).bind(code).first<ConceptRow>();
    if (!row) return json({ ok:false, error:'AP_CONCEPT_NOT_FOUND' }, 404);
    const [typesResult, questionsResult] = await Promise.all([
      env.song_project_db.prepare(`
        SELECT id,type_no,type_name_ko,type_name_ja,sort_order FROM ap_concept_problem_types
        WHERE concept_id=?1 ORDER BY sort_order ASC,type_no ASC
      `).bind(row.id).all<TypeRow>(),
      env.song_project_db.prepare(`
        SELECT q.id,q.problem_type_id,q.question_no,q.question_ko,q.question_ja,
          q.choices_ko_json,q.choices_ja_json,q.correct_choice,q.answer_ko,q.answer_ja,
          q.explanation_ko,q.explanation_ja,q.difficulty,q.sort_order
        FROM ap_concept_questions q
        JOIN ap_concept_problem_types t ON t.id=q.problem_type_id
        WHERE t.concept_id=?1 ORDER BY t.sort_order ASC,q.sort_order ASC,q.question_no ASC
      `).bind(row.id).all<QuestionRow>(),
    ]);
    const grouped = typesResult.results.map((type) => ({
      no: type.type_no, nameKo:type.type_name_ko, nameJa:type.type_name_ja,
      questions: questionsResult.results.filter((q)=>q.problem_type_id===type.id).map((q)=>({
        no:q.question_no, questionKo:q.question_ko, questionJa:q.question_ja,
        choicesKo:parseChoices(q.choices_ko_json), choicesJa:parseChoices(q.choices_ja_json),
        correctChoice:q.correct_choice, answerKo:q.answer_ko, answerJa:q.answer_ja,
        explanationKo:q.explanation_ko, explanationJa:q.explanation_ja, difficulty:q.difficulty,
      })),
    }));
    return json({ ok:true, concept:mapConcept(row), problemTypes:grouped });
  } catch (error) {
    console.error('Failed to load AP concept library', error);
    return json({ ok:false, error:'AP_CONCEPT_LIBRARY_FAILED' }, 500);
  }
}
