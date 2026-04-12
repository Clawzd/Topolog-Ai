import { useLocation } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center">
        <div className="space-y-2">
          <h1 className="text-7xl font-light text-muted-foreground/40">404</h1>
          <div className="mx-auto h-0.5 w-16 bg-border" />
        </div>
        <div className="mt-6 space-y-3">
          <h2 className="text-2xl font-medium text-foreground">Page not found</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">&quot;{pageName}&quot;</span> is not a route in this app.
          </p>
        </div>
        <div className="pt-8">
          <a
            href="/"
            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
