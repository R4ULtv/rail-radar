export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">You&apos;re offline</h1>
        <p className="mt-2 text-muted-foreground">
          Rail Radar needs an internet connection to show live train data.
        </p>
      </div>
    </div>
  );
}
