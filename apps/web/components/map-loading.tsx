export default function MapLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-2">
      <div className="size-2 bg-accent rounded-full animate-pulse" />
      <div className="size-2 bg-accent rounded-full animate-pulse [animation-delay:0.2s]" />
      <div className="size-2 bg-accent rounded-full animate-pulse [animation-delay:0.4s]" />
    </div>
  );
}
