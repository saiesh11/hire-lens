export function InterviewQuestions({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
      <h3 className="mb-3 font-semibold text-indigo-900">Suggested Interview Questions</h3>
      <ol className="flex list-decimal flex-col gap-2 pl-5">
        {questions.map((q, i) => (
          <li key={i} className="text-sm text-indigo-900">
            {q}
          </li>
        ))}
      </ol>
    </div>
  );
}
