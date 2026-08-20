import { useState } from "react";
import { useClerk } from "@clerk/clerk-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDefaultSort, setDefaultSort } from "../lib/preferences";
import { SORT_LABELS } from "../lib/types";
import type { SortOption } from "../lib/types";

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const clerk = useClerk();
  const [sortOption, setSortOption] = useState<SortOption>(getDefaultSort);

  function handleSortChange(value: SortOption) {
    setSortOption(value);
    setDefaultSort(value);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Button variant="link" onClick={onBack} className="mb-6 h-auto p-0 text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
        ← Back
      </Button>

      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">Settings</h1>

      <div className="flex flex-col gap-6">
        <Card className="rounded-2xl shadow-sm">
          <CardContent>
            <h2 className="mb-1 text-base font-semibold text-foreground">Account</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Manage your email, password, and active sessions.
            </p>
            <Button
              variant="outline"
              onClick={() => clerk.openUserProfile()}
              className="h-auto rounded-lg px-4 py-2"
            >
              Manage Account
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent>
            <h2 className="mb-1 text-base font-semibold text-foreground">Organization</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Invite teammates, manage roles, and update organization settings.
            </p>
            <Button
              variant="outline"
              onClick={() => clerk.openOrganizationProfile()}
              className="h-auto rounded-lg px-4 py-2"
            >
              Manage Organization
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent>
            <h2 className="mb-1 text-base font-semibold text-foreground">Default Candidate Sort</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              How a job's candidate list is sorted when you first open it.
            </p>
            <Select value={sortOption} onValueChange={(v) => handleSortChange(v as SortOption)}>
              <SelectTrigger className="w-[220px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {SORT_LABELS[opt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
