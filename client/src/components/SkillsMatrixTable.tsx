import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SkillMatrixEntry } from "../lib/types";

const STATUS_CONFIG: Record<SkillMatrixEntry["status"], { label: string; classes: string }> = {
  present: { label: "Present", classes: "bg-green-100 text-green-800" },
  partial: { label: "Partial", classes: "bg-amber-100 text-amber-800" },
  missing: { label: "Missing", classes: "bg-red-100 text-red-800" },
};

export function SkillsMatrixTable({ entries }: { entries: SkillMatrixEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Skills Matrix</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Skill</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, i) => {
              const status = STATUS_CONFIG[entry.status];
              return (
                <TableRow key={i}>
                  <TableCell className="font-medium text-gray-800">{entry.skill}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`rounded-full border-transparent px-2 py-0.5 text-xs font-medium ${status.classes}`}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal text-gray-600">{entry.evidence}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
