export function DatabaseErrorCallout(props: { title: string; description: string }) {
  return (
    <div
      className="rounded-lg border border-red-600/40 bg-red-600/5 px-4 py-3 text-sm text-red-950 dark:text-red-200"
      role="alert"
    >
      <p className="font-medium">{props.title}</p>
      <p className="mt-2 opacity-90 whitespace-pre-wrap">{props.description}</p>
    </div>
  );
}
