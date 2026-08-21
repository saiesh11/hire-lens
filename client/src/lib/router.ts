export type View =
  | { name: "dashboard" }
  | { name: "jobs" }
  | { name: "job-detail"; jobId: string }
  | { name: "candidate-detail"; candidateId: string; jobId: string }
  | { name: "settings" };

export function pathForView(view: View): string {
  switch (view.name) {
    case "dashboard":
      return "/";
    case "jobs":
      return "/jobs";
    case "job-detail":
      return `/jobs/${view.jobId}`;
    case "candidate-detail":
      return `/jobs/${view.jobId}/candidates/${view.candidateId}`;
    case "settings":
      return "/settings";
  }
}

export function viewFromPath(pathname: string): View {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "jobs" && segments[1] && segments[2] === "candidates" && segments[3]) {
    return { name: "candidate-detail", jobId: segments[1], candidateId: segments[3] };
  }
  if (segments[0] === "jobs" && segments[1]) {
    return { name: "job-detail", jobId: segments[1] };
  }
  if (segments[0] === "jobs") {
    return { name: "jobs" };
  }
  if (segments[0] === "settings") {
    return { name: "settings" };
  }
  return { name: "dashboard" };
}
