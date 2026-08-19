import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InterviewQuestions({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null;

  return (
    <Card className="rounded-2xl border-indigo-200 bg-indigo-50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-indigo-900">Suggested Interview Questions</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {questions.map((q, i) => (
            <li key={i} className="text-sm text-indigo-900">
              {q}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
